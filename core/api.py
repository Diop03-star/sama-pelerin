from datetime import timedelta

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_POST
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Agence,
    Document,
    Groupe,
    Paiement,
    Pelerin,
    PlanPaiement,
    Rappel,
    Tranche,
    Utilisateur,
)
from .serializers import (
    AgenceSerializer,
    DocumentSerializer,
    GroupeSerializer,
    PaiementSerializer,
    PelerinDetailSerializer,
    PelerinListSerializer,
    PelerinWriteSerializer,
    PlanPaiementCreateSerializer,
    PlanPaiementSerializer,
    RappelSerializer,
    TrancheSerializer,
)


# ---------------------------------------------------------------------------
# MULTI-TENANT : résolution de l'agence du compte connecté
# ---------------------------------------------------------------------------

def get_agence(request):
    """Agence liée au compte connecté ; None = staff (vision globale)."""
    if request.user.is_staff:
        return None
    profil = (
        Utilisateur.objects.filter(compte=request.user)
        .select_related("agence")
        .first()
    )
    if profil is None:
        raise PermissionDenied(
            "Aucune agence n'est associée à ce compte. Contactez l'administrateur."
        )
    return profil.agence


class AgenceScopedViewSet(viewsets.ModelViewSet):
    """ViewSet de base : filtre chaque queryset par l'agence du compte connecté.

    `agence_field` : look-up (ex: "agence", "groupe__agence"). Si None, le
    ViewSet gère lui-même son filtrage.
    """

    agence_field = None

    def get_queryset(self):
        qs = super().get_queryset()
        agence = get_agence(self.request)
        if agence is None or self.agence_field is None:
            return qs
        return qs.filter(**{self.agence_field: agence})


# ---------------------------------------------------------------------------
# AGENCES
# ---------------------------------------------------------------------------

class AgenceViewSet(viewsets.ModelViewSet):
    queryset = Agence.objects.all()
    serializer_class = AgenceSerializer

    def get_queryset(self):
        agence = get_agence(self.request)
        if agence is None:
            return self.queryset
        return self.queryset.filter(pk=agence.pk)

    def perform_create(self, serializer):
        agence = get_agence(self.request)
        if agence is not None:
            raise PermissionDenied("Seul l'administrateur peut créer une agence.")
        serializer.save()


# ---------------------------------------------------------------------------
# GROUPES
# ---------------------------------------------------------------------------

class GroupeViewSet(AgenceScopedViewSet):
    agence_field = "agence"
    queryset = Groupe.objects.select_related("agence").all()
    serializer_class = GroupeSerializer

    def _agence_cible(self, serializer, instance=None):
        agence = get_agence(self.request)
        if agence is not None:
            return agence
        agence = serializer.validated_data.get("agence")
        if agence is None and instance is not None:
            agence = instance.agence
        if agence is None:
            raise ValidationError(
                {"agence": "Choisissez une agence (compte administrateur)."}
            )
        return agence

    def perform_create(self, serializer):
        serializer.save(agence=self._agence_cible(serializer))

    def perform_update(self, serializer):
        serializer.save(agence=self._agence_cible(serializer, self.get_object()))

    @action(detail=True, methods=["get"])
    def pelerins(self, request, pk=None):
        groupe = self.get_object()
        pelerins = groupe.pelerins.all()
        return Response(PelerinListSerializer(pelerins, many=True).data)


# ---------------------------------------------------------------------------
# PÈLERINS
# ---------------------------------------------------------------------------

class PelerinViewSet(AgenceScopedViewSet):
    agence_field = "groupe__agence"
    queryset = Pelerin.objects.select_related("groupe", "groupe__agence").all()

    def get_serializer_class(self):
        if self.action == "list":
            return PelerinListSerializer
        if self.action in ("create", "update", "partial_update"):
            return PelerinWriteSerializer
        return PelerinDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["agence"] = get_agence(self.request)
        return context

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(nom__icontains=search)
                | Q(prenom__icontains=search)
                | Q(telephone__icontains=search)
            )
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut_dossier=statut)
        groupe = self.request.query_params.get("groupe")
        if groupe:
            qs = qs.filter(groupe_id=groupe)
        return qs.order_by("-date_inscription")

    @action(detail=True, methods=["get"])
    def documents(self, request, pk=None):
        pelerin = self.get_object()
        documents = pelerin.documents.all().order_by("type_document")
        return Response(DocumentSerializer(documents, many=True).data)

    @action(detail=True, methods=["post"])
    def plan(self, request, pk=None):
        pelerin = self.get_object()
        if hasattr(pelerin, "plan_paiement"):
            return Response(
                {"detail": "Un plan de paiement existe déjà pour ce pèlerin."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PlanPaiementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        montant_total = serializer.validated_data["montant_total"]
        nombre_tranches = serializer.validated_data["nombre_tranches"]
        devise = serializer.validated_data.get("devise", "FCFA")

        plan = PlanPaiement.objects.create(
            pelerin=pelerin,
            montant_total=montant_total,
            devise=devise,
            nombre_tranches=nombre_tranches,
        )

        montant_base = montant_total // nombre_tranches
        reste = montant_total - montant_base * nombre_tranches
        debut = timezone.now().date() + timedelta(days=30)
        for i in range(nombre_tranches):
            montant = montant_base + (reste if i == nombre_tranches - 1 else 0)
            Tranche.objects.create(
                plan_paiement=plan,
                numero_tranche=i + 1,
                montant_prevu=montant,
                date_echeance=debut + timedelta(days=30 * i),
            )
        return Response(
            PlanPaiementSerializer(plan).data, status=status.HTTP_201_CREATED
        )


# ---------------------------------------------------------------------------
# DOCUMENTS
# ---------------------------------------------------------------------------

class DocumentViewSet(AgenceScopedViewSet):
    agence_field = "pelerin__groupe__agence"
    queryset = Document.objects.select_related("pelerin", "pelerin__groupe").all()
    serializer_class = DocumentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        pelerin = self.request.query_params.get("pelerin")
        if pelerin:
            qs = qs.filter(pelerin_id=pelerin)
        return qs

    def perform_create(self, serializer):
        pelerin = serializer.validated_data.get("pelerin")
        document = serializer.save(
            date_upload=timezone.now(),
            statut=serializer.validated_data.get("statut", "soumis"),
        )
        if pelerin:
            pelerin.maj_statut_dossier()


# ---------------------------------------------------------------------------
# TRANCHES & PAIEMENTS
# ---------------------------------------------------------------------------

class TrancheViewSet(AgenceScopedViewSet):
    agence_field = "plan_paiement__pelerin__groupe__agence"
    queryset = Tranche.objects.select_related(
        "plan_paiement", "plan_paiement__pelerin"
    ).all()
    serializer_class = TrancheSerializer

    def get_serializer_class(self):
        return TrancheSerializer

    @action(detail=True, methods=["get", "post"])
    def versements(self, request, pk=None):
        tranche = self.get_object()
        if request.method == "GET":
            paiements = tranche.paiements.select_related("enregistre_par").all()
            return Response(PaiementSerializer(paiements, many=True).data)

        serializer = PaiementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        montant = serializer.validated_data["montant_paye"]
        if montant <= 0:
            raise ValidationError({"montant_paye": "Le montant doit être positif."})
        paiement = serializer.save(
            tranche=tranche,
            enregistre_par=Utilisateur.objects.filter(compte=request.user).first(),
        )
        tranche.maj_statut()
        tranche.plan_paiement.pelerin.maj_statut_dossier()
        return Response(
            PaiementSerializer(paiement).data, status=status.HTTP_201_CREATED
        )


# ---------------------------------------------------------------------------
# RAPPELS
# ---------------------------------------------------------------------------

class RappelViewSet(AgenceScopedViewSet):
    queryset = Rappel.objects.select_related(
        "tranche", "document", "tranche__plan_paiement__pelerin"
    ).all()
    serializer_class = RappelSerializer

    def get_queryset(self):
        qs = self.queryset
        agence = get_agence(self.request)
        if agence is None:
            return qs
        return qs.filter(
            Q(tranche__plan_paiement__pelerin__groupe__agence=agence)
            | Q(document__pelerin__groupe__agence=agence)
        )

    @action(detail=True, methods=["patch"])
    def marquer(self, request, pk=None):
        rappel = self.get_object()
        statut = request.data.get("statut_envoi")
        if statut not in dict(Rappel.STATUT_ENVOI_CHOICES):
            raise ValidationError({"statut_envoi": "Valeur invalide."})
        rappel.statut_envoi = statut
        if statut == "envoye":
            rappel.date_envoi_reelle = timezone.now()
        rappel.save(update_fields=["statut_envoi", "date_envoi_reelle"])
        return Response(RappelSerializer(rappel).data)


# ---------------------------------------------------------------------------
# DASHBOARD (orienté action)
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    agence = get_agence(request)

    if isinstance(agence, Agence):
        groupes = agence.groupes
        pelerins = Pelerin.objects.filter(groupe__agence=agence)
        plans = PlanPaiement.objects.filter(pelerin__groupe__agence=agence)
        tranches = Tranche.objects.filter(plan_paiement__pelerin__groupe__agence=agence)
        paiements_qs = Paiement.objects.filter(
            tranche__plan_paiement__pelerin__groupe__agence=agence
        )
        documents_qs = Document.objects.filter(pelerin__groupe__agence=agence)
        rappels_qs = Rappel.objects.filter(
            Q(tranche__plan_paiement__pelerin__groupe__agence=agence)
            | Q(document__pelerin__groupe__agence=agence)
        )
        info_agence = {"id": agence.pk, "nom": agence.nom}
    else:
        groupes = Groupe.objects.all()
        pelerins = Pelerin.objects.all()
        plans = PlanPaiement.objects.all()
        tranches = Tranche.objects.all()
        paiements_qs = Paiement.objects.all()
        documents_qs = Document.objects.all()
        rappels_qs = Rappel.objects.all()
        info_agence = None

    today = timezone.now().date()
    seuil_expiration = today + timedelta(days=30)

    total_du = plans.aggregate(total_p=Sum("montant_total"))["total_p"] or 0
    total_paye = paiements_qs.aggregate(total_p=Sum("montant_paye"))["total_p"] or 0

    alertes = {
        "pelerins_incomplets": pelerins.filter(statut_dossier="incomplet").count(),
        "paiements_en_retard": tranches.filter(
            Q(statut="en_retard") | Q(statut="a_venir", date_echeance__lt=today)
        ).count(),
        "documents_expirants": documents_qs.filter(
            date_expiration__isnull=False,
            date_expiration__lt=seuil_expiration,
            statut__in=["manquant", "soumis", "rejete"],
        ).count(),
        "rappels_en_attente": rappels_qs.filter(statut_envoi="en_attente").count(),
    }

    derniers_pelerins = pelerins.order_by("-date_inscription")[:5]
    derniers_paiements = paiements_qs.select_related(
        "tranche__plan_paiement__pelerin", "enregistre_par"
    ).order_by("-date_paiement")[:5]

    return Response(
        {
            "agence": info_agence,
            "compteurs": {
                "groupes": groupes.count(),
                "pelerins": pelerins.count(),
                "places_restantes": sum(
                    max(0, g.nb_places_max - g.pelerins.count()) for g in groupes.select_related().prefetch_related("pelerins")
                ),
            },
            "alertes": alertes,
            "finance": {
                "total_du": total_du,
                "total_paye": total_paye,
                "total_reste_du": total_du - total_paye,
            },
            "derniers_pelerins": PelerinListSerializer(derniers_pelerins, many=True).data,
            "derniers_paiements": PaiementSerializer(derniers_paiements, many=True).data,
        }
    )


# ---------------------------------------------------------------------------
# PROFIL / SESSION
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def moi(request):
    agence = get_agence(request)
    profil = (
        Utilisateur.objects.select_related("agence")
        .filter(compte=request.user)
        .first()
    )
    return Response(
        {
            "id": request.user.pk,
            "username": request.user.username,
            "nom": request.user.get_full_name() or request.user.username,
            "is_staff": request.user.is_staff,
            "agence": AgenceSerializer(agence).data if isinstance(agence, Agence) else None,
            "role": profil.role if profil else None,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_endpoint(request):
    return JsonResponse({"detail": "Cookie CSRF posé."})


@csrf_protect
@require_POST
@permission_classes([AllowAny])
def api_login(request):
    user = authenticate(
        request,
        username=request.POST.get("username"),
        password=request.POST.get("password"),
    )
    if user is None:
        return JsonResponse({"detail": "Identifiants invalides."}, status=400)
    login(request, user)
    return JsonResponse({"detail": "Connecté."})


@login_required
@require_POST
def api_logout(request):
    logout(request)
    return JsonResponse({"detail": "Déconnecté."})