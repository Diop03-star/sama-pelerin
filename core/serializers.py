from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from .models import (
    Agence,
    Utilisateur,
    Groupe,
    Pelerin,
    Document,
    PlanPaiement,
    Tranche,
    Paiement,
    Rappel,
)


# ---------------------------------------------------------------------------
# RÉFÉRENTIELS
# ---------------------------------------------------------------------------

class AgenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agence
        fields = ["id", "nom", "telephone", "email", "adresse"]


class UtilisateurSerializer(serializers.ModelSerializer):
    agence = AgenceSerializer(read_only=True)

    class Meta:
        model = Utilisateur
        fields = ["id", "nom", "telephone", "email", "role", "agence"]


class GroupeSerializer(serializers.ModelSerializer):
    nb_pelerins_inscrits = serializers.IntegerField(read_only=True)
    type_voyage_label = serializers.CharField(source="get_type_voyage_display", read_only=True)
    places_disponibles = serializers.SerializerMethodField()
    agence_nom = serializers.CharField(source="agence.nom", read_only=True)

    class Meta:
        model = Groupe
        fields = [
            "id", "agence", "agence_nom", "nom", "type_voyage", "type_voyage_label",
            "date_depart", "date_retour", "nb_places_max",
            "nb_pelerins_inscrits", "places_disponibles", "date_creation",
        ]
        read_only_fields = ["date_creation"]
        extra_kwargs = {"agence": {"required": False}}

    def get_places_disponibles(self, obj):
        return max(0, obj.nb_places_max - obj.nb_pelerins_inscrits)


# ---------------------------------------------------------------------------
# DOCUMENTS
# ---------------------------------------------------------------------------

class DocumentSerializer(serializers.ModelSerializer):
    type_document_label = serializers.CharField(source="get_type_document_display", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "pelerin", "type_document", "type_document_label",
            "fichier", "date_expiration", "statut", "statut_label", "date_upload",
        ]
        read_only_fields = ["date_upload"]


# ---------------------------------------------------------------------------
# PAIEMENTS
# ---------------------------------------------------------------------------

class PaiementSerializer(serializers.ModelSerializer):
    mode_label = serializers.CharField(source="get_mode_display", read_only=True)
    enregistre_par_nom = serializers.CharField(source="enregistre_par.nom", read_only=True, default=None)

    class Meta:
        model = Paiement
        fields = [
            "id", "tranche", "montant_paye", "date_paiement", "mode",
            "mode_label", "reference", "enregistre_par", "enregistre_par_nom",
        ]
        read_only_fields = ["tranche", "date_paiement", "enregistre_par"]


class TrancheSerializer(serializers.ModelSerializer):
    montant_verse = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    paiements = PaiementSerializer(many=True, read_only=True)

    class Meta:
        model = Tranche
        fields = [
            "id", "plan_paiement", "numero_tranche", "montant_prevu",
            "date_echeance", "statut", "statut_label", "montant_verse", "paiements",
        ]
        read_only_fields = ["statut"]


class PlanPaiementSerializer(serializers.ModelSerializer):
    montant_paye = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    reste_du = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    tranches = TrancheSerializer(many=True, read_only=True)

    class Meta:
        model = PlanPaiement
        fields = [
            "id", "pelerin", "montant_total", "devise", "nombre_tranches",
            "montant_paye", "reste_du", "tranches", "date_creation",
        ]
        read_only_fields = ["date_creation"]


class PlanPaiementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanPaiement
        fields = ["montant_total", "devise", "nombre_tranches"]


# ---------------------------------------------------------------------------
# RAPPELS
# ---------------------------------------------------------------------------

class RappelSerializer(serializers.ModelSerializer):
    canal_label = serializers.CharField(source="get_canal_display", read_only=True)
    statut_envoi_label = serializers.CharField(source="get_statut_envoi_display", read_only=True)
    motif = serializers.SerializerMethodField()
    cible = serializers.SerializerMethodField()

    class Meta:
        model = Rappel
        fields = [
            "id", "tranche", "document", "canal", "canal_label",
            "date_envoi_prevue", "date_envoi_reelle", "statut_envoi",
            "statut_envoi_label", "motif", "cible",
        ]
        read_only_fields = fields

    def get_motif(self, obj):
        if obj.tranche:
            return f"Paiement tranche {obj.tranche.numero_tranche}"
        if obj.document:
            return f"Document {obj.document.get_type_document_display()}"
        return ""

    def get_cible(self, obj):
        pelerin = obj.tranche.plan_paiement.pelerin if obj.tranche else (obj.document.pelerin if obj.document else None)
        if pelerin is None:
            return None
        return {
            "id": pelerin.id,
            "nom": f"{pelerin.prenom} {pelerin.nom}",
            "telephone": pelerin.telephone,
        }


# ---------------------------------------------------------------------------
# PÈLERINS
# ---------------------------------------------------------------------------

class PelerinListSerializer(serializers.ModelSerializer):
    groupe_nom = serializers.CharField(source="groupe.nom", read_only=True)
    statut_dossier_label = serializers.CharField(source="get_statut_dossier_display", read_only=True)
    nb_documents = serializers.SerializerMethodField()
    nb_documents_manquants = serializers.SerializerMethodField()

    class Meta:
        model = Pelerin
        fields = [
            "id", "groupe", "groupe_nom", "nom", "prenom", "telephone",
            "statut_dossier", "statut_dossier_label", "nb_documents",
            "nb_documents_manquants", "date_inscription",
        ]

    def get_nb_documents(self, obj):
        return obj.documents.count()

    def get_nb_documents_manquants(self, obj):
        return obj.documents.filter(statut="manquant").count()


class PelerinDetailSerializer(serializers.ModelSerializer):
    statut_dossier_label = serializers.CharField(source="get_statut_dossier_display", read_only=True)
    sexe_label = serializers.CharField(source="get_sexe_display", read_only=True, default=None)
    documents = DocumentSerializer(many=True, read_only=True)
    plan_paiement = PlanPaiementSerializer(read_only=True)

    class Meta:
        model = Pelerin
        fields = [
            "id", "groupe", "nom", "prenom", "telephone", "email",
            "date_naissance", "sexe", "sexe_label", "contact_urgence_nom",
            "contact_urgence_telephone", "statut_dossier", "statut_dossier_label",
            "documents", "plan_paiement", "date_inscription",
        ]
        read_only_fields = ["statut_dossier", "documents", "plan_paiement", "date_inscription"]


class PelerinWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pelerin
        fields = [
            "id", "groupe", "nom", "prenom", "telephone", "email", "date_naissance",
            "sexe", "contact_urgence_nom", "contact_urgence_telephone",
        ]
        read_only_fields = ["id"]

    def validate_groupe(self, groupe):
        agence = self.context.get("agence")
        if agence is not None and groupe.agence_id != agence.id:
            raise ValidationError("Ce groupe n'appartient pas à votre agence.")
        return groupe

    def create(self, validated_data):
        pelerin = Pelerin.objects.create(**validated_data)
        for type_document in ["passeport", "visa", "certificat_vaccination", "photo"]:
            Document.objects.get_or_create(
                pelerin=pelerin, type_document=type_document, defaults={"statut": "manquant"}
            )
        pelerin.maj_statut_dossier()
        return pelerin

    def update(self, instance, validated_data):
        pelerin = super().update(instance, validated_data)
        pelerin.maj_statut_dossier()
        return pelerin