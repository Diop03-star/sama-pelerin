from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

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

# ---------------------------------------------------------------------------
# Fabriques
# ---------------------------------------------------------------------------

def creer_agence(nom="Agence Test"):
    return Agence.objects.create(
        nom=nom, telephone="+221 77 000 00 00", email=f"{nom.lower()}@test.sn"
    )


def creer_groupe(agence, nom="Hajj 2027"):
    return Groupe.objects.create(
        agence=agence,
        nom=nom,
        type_voyage="hajj",
        date_depart=date.today() + timedelta(days=180),
        date_retour=date.today() + timedelta(days=210),
        nb_places_max=50,
    )


def creer_pelerin(groupe, nom="NDIAYE", prenom="Mariam"):
    pelerin = Pelerin.objects.create(
        groupe=groupe,
        nom=nom,
        prenom=prenom,
        telephone="+221 77 123 45 67",
    )
    for type_document in ["passeport", "visa", "certificat_vaccination", "photo"]:
        Document.objects.get_or_create(
            pelerin=pelerin, type_document=type_document, defaults={"statut": "manquant"}
        )
    pelerin.maj_statut_dossier()
    return pelerin


# ---------------------------------------------------------------------------
# Cas de base : superuser + deux agences isolées
# ---------------------------------------------------------------------------

class BaseApiTest(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser("admin", "admin@t.l", "x")

        self.agence_a = creer_agence("Agence Alpha")
        self.agence_b = creer_agence("Agence Beta")

        self.groupe_a = creer_groupe(self.agence_a, "Hajj Alpha 2027")
        self.groupe_b = creer_groupe(self.agence_b, "Hajj Beta 2027")

        self.pelerin_a = creer_pelerin(self.groupe_a, "NDIAYE", "Mariam")
        self.pelerin_b = creer_pelerin(self.groupe_b, "DIOP", "Youssouf")

        self.user_a = User.objects.create_user("agent-a", "pwd-a")
        Utilisateur.objects.create(
            agence=self.agence_a,
            nom="Agent Alpha",
            telephone="+221 77 111 22 33",
            role="agent",
            compte=self.user_a,
        )


# ---------------------------------------------------------------------------
# Authentification & profil
# ---------------------------------------------------------------------------

class TestAuthentification(APITestCase):
    def test_authentification_requise(self):
        reponse = self.client.get("/api/v1/groupes/")
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_moi_admin_sans_agence(self):
        admin = User.objects.create_superuser("admin", "a@t.l", "x")
        self.client.force_login(admin)
        reponse = self.client.get("/api/v1/moi/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertIsNone(reponse.json()["agence"])

    def test_moi_avec_agence(self):
        agence = creer_agence()
        user = User.objects.create_user("comptable", "x")
        Utilisateur.objects.create(agence=agence, nom="U", compte=user)
        self.client.force_login(user)
        reponse = self.client.get("/api/v1/moi/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.json()["agence"]["nom"], agence.nom)


# ---------------------------------------------------------------------------
# Filtrage par agence (multi-tenant)
# ---------------------------------------------------------------------------

class TestFiltrageAgence(APITestCase):
    def setUp(self):
        self.agence_a = creer_agence("Alpha")
        self.agence_b = creer_agence("Beta")
        self.groupe_a = creer_groupe(self.agence_a, "Groupe-A")
        self.groupe_b = creer_groupe(self.agence_b, "Groupe-B")
        self.pelerin_a = creer_pelerin(self.groupe_a, "NDIAYE", "M")
        self.pelerin_b = creer_pelerin(self.groupe_b, "DIOP", "Y")
        self.user_a = User.objects.create_user("agent-a", "x")
        Utilisateur.objects.create(agence=self.agence_a, nom="A", compte=self.user_a)
        self.client.force_login(self.user_a)

    def test_groupes_limites_a_son_agence(self):
        reponse = self.client.get("/api/v1/groupes/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        noms = [g["nom"] for g in reponse.json()]
        self.assertIn("Groupe-A", noms)
        self.assertNotIn("Groupe-B", noms)

    def test_pelerins_limites_a_son_agence(self):
        reponse = self.client.get("/api/v1/pelerins/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(len(reponse.json()), 1)
        self.assertEqual(reponse.json()[0]["nom"], "NDIAYE")

    def test_creation_groupe_force_son_agence(self):
        reponse = self.client.post(
            "/api/v1/groupes/",
            {
                "nom": "Groupe Nouveau",
                "type_voyage": "omra",
                "date_depart": "2027-01-01",
                "date_retour": "2027-01-15",
                "nb_places_max": 10,
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Groupe.objects.latest("id").agence_id, self.agence_a.id)

    def test_pelerin_dans_groupe_etranger_refuse(self):
        reponse = self.client.post(
            "/api/v1/pelerins/",
            {
                "groupe": self.groupe_b.id,
                "nom": "SARR",
                "prenom": "Awa",
                "telephone": "+221 77 000 00 01",
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# CRUD pèlerin
# ---------------------------------------------------------------------------

class TestPelerinCRUD(BaseApiTest):
    def test_creation_pelerin_genere_les_4_documents(self):
        self.client.force_login(self.staff)
        reponse = self.client.post(
            "/api/v1/pelerins/",
            {
                "groupe": self.groupe_a.id,
                "nom": "FALL",
                "prenom": "Awa",
                "telephone": "+221 77 999 99 99",
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        pelerin = Pelerin.objects.get(pk=reponse.json()["id"])
        self.assertEqual(pelerin.documents.count(), 4)
        self.assertEqual(
            set(pelerin.documents.values_list("type_document", flat=True)),
            {"passeport", "visa", "certificat_vaccination", "photo"},
        )
        self.assertEqual(pelerin.statut_dossier, "incomplet")

    def test_detail_pelerin_avec_plan_et_tranches(self):
        self.client.force_login(self.staff)
        plan = PlanPaiement.objects.create(
            pelerin=self.pelerin_a, montant_total=Decimal("2500000"), nombre_tranches=5
        )
        for i in range(5):
            Tranche.objects.create(
                plan_paiement=plan,
                numero_tranche=i + 1,
                montant_prevu=Decimal("500000"),
                date_echeance=date.today() + timedelta(days=30 * i),
            )
        reponse = self.client.get(f"/api/v1/pelerins/{self.pelerin_a.id}/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        donnees = reponse.json()
        self.assertIsNotNone(donnees["plan_paiement"])
        self.assertEqual(len(donnees["plan_paiement"]["tranches"]), 5)
        self.assertEqual(len(donnees["documents"]), 4)

    def test_statut_dossier_valide_quand_tout_est_valide(self):
        self.client.force_login(self.staff)
        pelerin = Pelerin.objects.get(pk=self.pelerin_a.pk)
        for doc in pelerin.documents.all():
            doc.statut = "valide"
            doc.save()
        pelerin.maj_statut_dossier()
        pelerin.refresh_from_db()
        self.assertEqual(pelerin.statut_dossier, "valide")


# ---------------------------------------------------------------------------
# Plan de paiement
# ---------------------------------------------------------------------------

class TestPlanPaiement(BaseApiTest):
    def test_creation_plan_genere_tranches_et_reste_du(self):
        self.client.force_login(self.staff)
        reponse = self.client.post(
            f"/api/v1/pelerins/{self.pelerin_a.id}/plan/",
            {"montant_total": 2500000, "nombre_tranches": 5},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        plan = PlanPaiement.objects.get(pelerin=self.pelerin_a)
        self.assertEqual(plan.tranches.count(), 5)
        montants = [t.montant_prevu for t in plan.tranches.all()]
        self.assertEqual(sum(montants), 2500000)
        self.assertEqual(plan.reste_du, 2500000)

    def test_plan_unique_par_pelerin(self):
        self.client.force_login(self.staff)
        PlanPaiement.objects.create(
            pelerin=self.pelerin_a, montant_total=Decimal("1000"), nombre_tranches=1
        )
        reponse = self.client.post(
            f"/api/v1/pelerins/{self.pelerin_a.id}/plan/",
            {"montant_total": 1000, "nombre_tranches": 1},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Versements
# ---------------------------------------------------------------------------

class TestVersement(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.plan = PlanPaiement.objects.create(
            pelerin=self.pelerin_a, montant_total=Decimal("1000000"), nombre_tranches=2
        )
        self.tranche = Tranche.objects.create(
            plan_paiement=self.plan,
            numero_tranche=1,
            montant_prevu=Decimal("500000"),
            date_echeance=date.today() + timedelta(days=30),
        )

    def test_versement_partiel_statut_partielle(self):
        self.client.force_login(self.staff)
        reponse = self.client.post(
            f"/api/v1/tranches/{self.tranche.id}/versements/",
            {"montant_paye": 250000, "mode": "wave"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.tranche.refresh_from_db()
        self.assertEqual(self.tranche.statut, "partielle")
        self.assertEqual(self.plan.reste_du, 750000)

    def test_versement_total_statut_payee(self):
        self.client.force_login(self.staff)
        reponse = self.client.post(
            f"/api/v1/tranches/{self.tranche.id}/versements/",
            {"montant_paye": 500000, "mode": "especes"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.tranche.refresh_from_db()
        self.assertEqual(self.tranche.statut, "payee")
        self.assertEqual(self.plan.reste_du, 500000)

    def test_montant_negatif_refuse(self):
        self.client.force_login(self.staff)
        reponse = self.client.post(
            f"/api/v1/tranches/{self.tranche.id}/versements/",
            {"montant_paye": -100, "mode": "wave"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_versement_inscrit_enregistre_par(self):
        self.client.force_login(self.user_a)
        reponse = self.client.post(
            f"/api/v1/tranches/{self.tranche.id}/versements/",
            {"montant_paye": 100000, "mode": "wave"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        paiement = Paiement.objects.get(tranche=self.tranche)
        self.assertEqual(paiement.enregistre_par.compte_id, self.user_a.id)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class TestDashboard(BaseApiTest):
    def test_alertes_paiements_en_retard(self):
        self.client.force_login(self.staff)
        plan = PlanPaiement.objects.create(
            pelerin=self.pelerin_a, montant_total=Decimal("1000"), nombre_tranches=1
        )
        Tranche.objects.create(
            plan_paiement=plan,
            numero_tranche=1,
            montant_prevu=Decimal("1000"),
            date_echeance=date.today() - timedelta(days=10),
        )
        reponse = self.client.get("/api/v1/dashboard/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        donnees = reponse.json()
        self.assertEqual(donnees["alertes"]["paiements_en_retard"], 1)
        self.assertGreaterEqual(donnees["compteurs"]["pelerins"], 2)

    def test_dashboard_filtre_par_agence(self):
        self.client.force_login(self.user_a)
        reponse = self.client.get("/api/v1/dashboard/")
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        donnees = reponse.json()
        self.assertEqual(donnees["agence"]["nom"], "Agence Alpha")
        noms = [p["nom"] for p in donnees["derniers_pelerins"]]
        self.assertNotIn("DIOP", noms)


# ---------------------------------------------------------------------------
# Rappels
# ---------------------------------------------------------------------------

class TestRappels(BaseApiTest):
    def test_marquer_rappel_envoye(self):
        self.client.force_login(self.staff)
        rappel = Rappel.objects.create(
            document=self.pelerin_a.documents.first(),
            canal="whatsapp",
            date_envoi_prevue=timezone.now(),
        )
        reponse = self.client.patch(
            f"/api/v1/rappels/{rappel.id}/marquer/",
            {"statut_envoi": "envoye"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut_envoi, "envoye")
        self.assertIsNotNone(rappel.date_envoi_reelle)

    def test_statut_invalide_refuse(self):
        self.client.force_login(self.staff)
        rappel = Rappel.objects.create(
            document=self.pelerin_a.documents.first(),
            date_envoi_prevue=timezone.now(),
        )
        reponse = self.client.patch(
            f"/api/v1/rappels/{rappel.id}/marquer/",
            {"statut_envoi": "brouillon"},
            format="json",
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)