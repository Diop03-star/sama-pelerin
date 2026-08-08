#!/usr/bin/env python
"""
Génère des données de test pour le SaaS Hajj/Omra (contexte sénégalais).
"""
import os
import sys
import django
from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'saas_hajj.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from core.models import (
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


def create_test_data():
    print("Création des données de test...")

    # ------------------------------------------------------------------
    # Agences
    # ------------------------------------------------------------------
    agence1 = Agence.objects.create(
        nom="Al Hidjah Travel Dakar",
        telephone="+221 33 821 45 67",
        email="contact@alhidjah-dakar.sn",
        adresse="Dakar, Plateau, Avenue Lamine Guèye",
    )

    agence2 = Agence.objects.create(
        nom="Voyages Al-Barakah",
        telephone="+221 33 864 12 90",
        email="info@albarakah.sn",
        adresse="Dakar, Médina, Rue 21",
    )

    print(f"Agences créées : {agence1.nom}, {agence2.nom}")

    # ------------------------------------------------------------------
    # Utilisateurs
    # ------------------------------------------------------------------
    gerant1 = Utilisateur.objects.create(
        agence=agence1,
        nom="DIOP El Hadji Ibrahima",
        telephone="+221 77 123 45 67",
        email="ibrahima.diop@alhidjah-dakar.sn",
        role="gerant",
    )

    agent1 = Utilisateur.objects.create(
        agence=agence1,
        nom="NDIAYE Fatou",
        telephone="+221 76 234 56 78",
        email="fatou.ndiaye@alhidjah-dakar.sn",
        role="agent",
    )

    gerant2 = Utilisateur.objects.create(
        agence=agence2,
        nom="FALL Moussa",
        telephone="+221 70 345 67 89",
        email="moussa.fall@albarakah.sn",
        role="gerant",
    )

    print(f"Utilisateurs créés : {gerant1.nom}, {agent1.nom}, {gerant2.nom}")

    # ------------------------------------------------------------------
    # Groupes
    # ------------------------------------------------------------------
    groupe_hajj = Groupe.objects.create(
        agence=agence1,
        nom="Hajj 2027",
        type_voyage="hajj",
        date_depart=date.today() + timedelta(days=180),
        date_retour=date.today() + timedelta(days=210),
        nb_places_max=50,
    )

    groupe_omra = Groupe.objects.create(
        agence=agence1,
        nom="Omra Ramadan 2027",
        type_voyage="omra",
        date_depart=date.today() + timedelta(days=365),
        date_retour=date.today() + timedelta(days=380),
        nb_places_max=30,
    )

    groupe_omra2 = Groupe.objects.create(
        agence=agence2,
        nom="Omra Décembre 2026",
        type_voyage="omra",
        date_depart=date.today() + timedelta(days=120),
        date_retour=date.today() + timedelta(days=140),
        nb_places_max=25,
    )

    print(f"Groupes créés : {groupe_hajj.nom}, {groupe_omra.nom}, {groupe_omra2.nom}")

    # ------------------------------------------------------------------
    # Pèlerins
    # ------------------------------------------------------------------
    pelerin1 = Pelerin.objects.create(
        groupe=groupe_hajj,
        nom="NDIAYE",
        prenom="Mariam",
        telephone="+221 77 111 22 33",
        email="mariam.ndiaye@email.sn",
        date_naissance=date(1990, 5, 15),
        sexe="F",
        contact_urgence_nom="Karim Ndiaye",
        contact_urgence_telephone="+221 76 444 55 66",
    )

    pelerin2 = Pelerin.objects.create(
        groupe=groupe_hajj,
        nom="DIOP",
        prenom="Youssouf",
        telephone="+221 78 555 66 77",
        email="youssouf.diop@email.sn",
        date_naissance=date(1985, 8, 22),
        sexe="M",
        contact_urgence_nom="Aminata Diop",
        contact_urgence_telephone="+221 75 666 77 88",
    )

    pelerin3 = Pelerin.objects.create(
        groupe=groupe_omra,
        nom="FALL",
        prenom="Aïssata",
        telephone="+221 70 777 88 99",
        email="aissata.fall@email.sn",
        date_naissance=date(1992, 3, 8),
        sexe="F",
        contact_urgence_nom="Ousmane Fall",
        contact_urgence_telephone="+221 76 888 99 00",
    )

    pelerin4 = Pelerin.objects.create(
        groupe=groupe_omra2,
        nom="SY",
        prenom="Abdoulaye",
        telephone="+221 77 999 00 11",
        email="abdoulaye.sy@email.sn",
        date_naissance=date(1988, 11, 30),
        sexe="M",
        contact_urgence_nom="Fatoumata Sy",
        contact_urgence_telephone="+221 78 000 11 22",
    )

    print(f"Pèlerins créés : {pelerin1.prenom} {pelerin1.nom}, {pelerin2.prenom} {pelerin2.nom}, {pelerin3.prenom} {pelerin3.nom}, {pelerin4.prenom} {pelerin4.nom}")

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------
    document_types = [
        ("passeport", "Passeport"),
        ("visa", "Visa"),
        ("certificat_vaccination", "Certificat de vaccination"),
        ("photo", "Photo d'identité"),
    ]

    # Mariam Ndiaye (Hajj) — visa manquant
    for doc_type, _ in document_types:
        Document.objects.create(
            pelerin=pelerin1,
            type_document=doc_type,
            statut="manquant" if doc_type == "visa" else "soumis",
            date_expiration=date.today() + timedelta(days=365) if doc_type == "passeport" else None,
        )

    # Youssouf Diop (Hajj) — dossier presque complet
    for doc_type, _ in document_types:
        statut = "valide" if doc_type in ["passeport", "photo"] else "soumis" if doc_type == "certificat_vaccination" else "manquant"
        Document.objects.create(
            pelerin=pelerin2,
            type_document=doc_type,
            statut=statut,
            date_expiration=date.today() + timedelta(days=500) if doc_type == "passeport" else None,
        )

    # Aïssata Fall (Omra)
    for doc_type, _ in document_types:
        statut = "soumis" if doc_type in ["passeport", "photo"] else "manquant"
        Document.objects.create(
            pelerin=pelerin3,
            type_document=doc_type,
            statut=statut,
            date_expiration=date.today() + timedelta(days=400) if doc_type == "passeport" else None,
        )

    # Abdoulaye Sy (Omra)
    for doc_type, _ in document_types:
        statut = "valide" if doc_type == "passeport" else "soumis" if doc_type in ["photo", "certificat_vaccination"] else "manquant"
        Document.objects.create(
            pelerin=pelerin4,
            type_document=doc_type,
            statut=statut,
            date_expiration=date.today() + timedelta(days=450) if doc_type == "passeport" else None,
        )

    print("Documents créés pour tous les pèlerins")

    # ------------------------------------------------------------------
    # Plans de paiement
    # ------------------------------------------------------------------
    plan1 = PlanPaiement.objects.create(
        pelerin=pelerin1,
        montant_total=Decimal('2500000'),
        devise="FCFA",
        nombre_tranches=5,
    )

    plan2 = PlanPaiement.objects.create(
        pelerin=pelerin2,
        montant_total=Decimal('2500000'),
        devise="FCFA",
        nombre_tranches=4,
    )

    plan3 = PlanPaiement.objects.create(
        pelerin=pelerin3,
        montant_total=Decimal('800000'),
        devise="FCFA",
        nombre_tranches=3,
    )

    plan4 = PlanPaiement.objects.create(
        pelerin=pelerin4,
        montant_total=Decimal('750000'),
        devise="FCFA",
        nombre_tranches=3,
    )

    print(f"Plans de paiement créés pour {pelerin1.prenom}, {pelerin2.prenom}, {pelerin3.prenom}, {pelerin4.prenom}")

    # ------------------------------------------------------------------
    # Tranches
    # ------------------------------------------------------------------
    base_date = date.today() + timedelta(days=30)

    for i in range(1, 6):
        Tranche.objects.create(
            plan_paiement=plan1,
            numero_tranche=i,
            montant_prevu=Decimal('500000'),
            date_echeance=base_date + timedelta(days=30 * (i - 1)),
        )

    for i in range(1, 5):
        Tranche.objects.create(
            plan_paiement=plan2,
            numero_tranche=i,
            montant_prevu=Decimal('625000'),
            date_echeance=base_date + timedelta(days=30 * (i - 1)),
        )

    for i in range(1, 4):
        Tranche.objects.create(
            plan_paiement=plan3,
            numero_tranche=i,
            montant_prevu=Decimal('266667'),
            date_echeance=base_date + timedelta(days=30 * (i - 1)),
        )

    for i in range(1, 4):
        Tranche.objects.create(
            plan_paiement=plan4,
            numero_tranche=i,
            montant_prevu=Decimal('250000'),
            date_echeance=base_date + timedelta(days=30 * (i - 1)),
        )

    print("Tranches créées")

    # ------------------------------------------------------------------
    # Paiements (dont un partiel pour tester le reste dû)
    # ------------------------------------------------------------------
    tranche_mariam_1 = plan1.tranches.get(numero_tranche=1)
    Paiement.objects.create(
        tranche=tranche_mariam_1,
        montant_paye=Decimal('250000'),  # 50 % de 500 000 — reste dû calculable
        mode="wave",
        reference="WV20260808001",
        enregistre_par=agent1,
    )
    tranche_mariam_1.maj_statut()

    tranche_youssouf_1 = plan2.tranches.get(numero_tranche=1)
    Paiement.objects.create(
        tranche=tranche_youssouf_1,
        montant_paye=tranche_youssouf_1.montant_prevu,
        mode="virement",
        reference="VT20260808002",
        enregistre_par=gerant1,
    )
    tranche_youssouf_1.maj_statut()

    print("Paiements créés (dont un partiel)")

    # ------------------------------------------------------------------
    # Rappels
    # ------------------------------------------------------------------
    Rappel.objects.create(
        tranche=tranche_mariam_1,
        canal="whatsapp",
        date_envoi_prevue=timezone.now() + timedelta(days=5),
        statut_envoi="en_attente",
    )

    Rappel.objects.create(
        document=pelerin2.documents.get(type_document="visa"),
        canal="whatsapp",
        date_envoi_prevue=timezone.now() + timedelta(days=3),
        statut_envoi="en_attente",
    )

    print("Rappels créés")

    # ------------------------------------------------------------------
    # Statuts de dossier recalculés
    # ------------------------------------------------------------------
    pelerin1.maj_statut_dossier()
    pelerin2.maj_statut_dossier()
    pelerin3.maj_statut_dossier()
    pelerin4.maj_statut_dossier()

    print("Statuts de dossier recalculés")

    # ------------------------------------------------------------------
    # Récapitulatif
    # ------------------------------------------------------------------
    print("\nCréation des données de test terminée !")
    print(f"Agences : {Agence.objects.count()}")
    print(f"Utilisateurs : {Utilisateur.objects.count()}")
    print(f"Groupes : {Groupe.objects.count()}")
    print(f"Pèlerins : {Pelerin.objects.count()}")
    print(f"Documents : {Document.objects.count()}")
    print(f"Plans de paiement : {PlanPaiement.objects.count()}")
    print(f"Tranches : {Tranche.objects.count()}")
    print(f"Paiements : {Paiement.objects.count()}")
    print(f"Rappels : {Rappel.objects.count()}")


if __name__ == "__main__":
    create_test_data()