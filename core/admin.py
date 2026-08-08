from django.contrib import admin
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
# AGENCES & UTILISATEURS
# ---------------------------------------------------------------------------

@admin.register(Agence)
class AgenceAdmin(admin.ModelAdmin):
    list_display = ("nom", "telephone", "email", "date_creation")
    search_fields = ("nom", "telephone", "email")


@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ("nom", "agence", "role", "telephone", "email")
    list_filter = ("agence", "role")
    search_fields = ("nom", "telephone", "email")


# ---------------------------------------------------------------------------
# GROUPES & PELERINS
# ---------------------------------------------------------------------------

class PelerinInline(admin.TabularInline):
    model = Pelerin
    extra = 0
    fields = ("nom", "prenom", "telephone", "statut_dossier")
    show_change_link = True


@admin.register(Groupe)
class GroupeAdmin(admin.ModelAdmin):
    list_display = ("nom", "agence", "type_voyage", "date_depart", "date_retour", "nb_pelerins_inscrits", "nb_places_max")
    list_filter = ("agence", "type_voyage")
    search_fields = ("nom",)
    inlines = [PelerinInline]


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 0
    fields = ("type_document", "statut", "date_expiration", "fichier")


@admin.register(Pelerin)
class PelerinAdmin(admin.ModelAdmin):
    list_display = ("nom", "prenom", "groupe", "telephone", "statut_dossier", "date_inscription")
    list_filter = ("groupe__agence", "groupe", "statut_dossier", "sexe")
    search_fields = ("nom", "prenom", "telephone", "email")
    inlines = [DocumentInline]
    actions = ["recalculer_statut_dossier"]

    @admin.action(description="Recalculer le statut du dossier")
    def recalculer_statut_dossier(self, request, queryset):
        for pelerin in queryset:
            pelerin.maj_statut_dossier()


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("pelerin", "type_document", "statut", "date_expiration", "date_upload")
    list_filter = ("type_document", "statut")
    search_fields = ("pelerin__nom", "pelerin__prenom")


# ---------------------------------------------------------------------------
# PAIEMENTS
# ---------------------------------------------------------------------------

class TrancheInline(admin.TabularInline):
    model = Tranche
    extra = 0
    fields = ("numero_tranche", "montant_prevu", "date_echeance", "statut")
    readonly_fields = ("statut",)


@admin.register(PlanPaiement)
class PlanPaiementAdmin(admin.ModelAdmin):
    list_display = ("pelerin", "montant_total", "devise", "nombre_tranches", "montant_paye", "reste_du")
    search_fields = ("pelerin__nom", "pelerin__prenom")
    inlines = [TrancheInline]


class PaiementInline(admin.TabularInline):
    model = Paiement
    extra = 0
    fields = ("montant_paye", "mode", "reference", "enregistre_par", "date_paiement")
    readonly_fields = ("date_paiement",)


@admin.register(Tranche)
class TrancheAdmin(admin.ModelAdmin):
    list_display = ("plan_paiement", "numero_tranche", "montant_prevu", "montant_verse", "date_echeance", "statut")
    list_filter = ("statut", "date_echeance")
    inlines = [PaiementInline]


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ("tranche", "montant_paye", "mode", "date_paiement", "enregistre_par")
    list_filter = ("mode", "date_paiement")
    search_fields = ("reference", "tranche__plan_paiement__pelerin__nom")


# ---------------------------------------------------------------------------
# RAPPELS
# ---------------------------------------------------------------------------

@admin.register(Rappel)
class RappelAdmin(admin.ModelAdmin):
    list_display = ("canal", "tranche", "document", "date_envoi_prevue", "statut_envoi")
    list_filter = ("canal", "statut_envoi")