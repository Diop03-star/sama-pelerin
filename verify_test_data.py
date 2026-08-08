#!/usr/bin/env python
"""
Vérifie l'intégrité des données de test : compteurs et calculs (reste dû, statuts).
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'saas_hajj.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.utils import timezone
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

erreurs = []


def verifier(condition, message):
    if condition:
        print(f"  OK  {message}")
    else:
        erreurs.append(message)
        print(f"FAIL  {message}")


def main():
    print("=== Vérification des données de test ===\n")

    # ------------------------------------------------------------------
    # Compteurs attendus
    # ------------------------------------------------------------------
    print("1. Compteurs :")
    verifier(Agence.objects.count() == 2, f"2 agences (trouvé : {Agence.objects.count()})")
    verifier(Utilisateur.objects.count() == 3, f"3 utilisateurs (trouvé : {Utilisateur.objects.count()})")
    verifier(Groupe.objects.count() == 3, f"3 groupes (trouvé : {Groupe.objects.count()})")
    verifier(Pelerin.objects.count() == 4, f"4 pèlerins (trouvé : {Pelerin.objects.count()})")
    verifier(Document.objects.count() == 16, f"16 documents (trouvé : {Document.objects.count()})")
    verifier(PlanPaiement.objects.count() == 4, f"4 plans de paiement (trouvé : {PlanPaiement.objects.count()})")
    verifier(Tranche.objects.count() == 15, f"15 tranches (trouvé : {Tranche.objects.count()})")
    verifier(Paiement.objects.count() == 2, f"2 paiements (trouvé : {Paiement.objects.count()})")
    verifier(Rappel.objects.count() == 2, f"2 rappels (trouvé : {Rappel.objects.count()})")

    # ------------------------------------------------------------------
    # Calcul du reste dû
    # ------------------------------------------------------------------
    print("\n2. Paiements et reste dû :")
    plan_mariam = PlanPaiement.objects.get(pelerin__nom="NDIAYE")
    verifier(plan_mariam.montant_paye == 250000, f"Mariam : 250 000 payés (trouvé : {plan_mariam.montant_paye})")
    verifier(plan_mariam.reste_du == 2250000, f"Mariam : reste dû 2 250 000 (trouvé : {plan_mariam.reste_du})")

    tranche1_mariam = plan_mariam.tranches.get(numero_tranche=1)
    verifier(tranche1_mariam.statut == "partielle", f"Tranche 1 Mariam partielle (trouvé : {tranche1_mariam.statut})")

    plan_youssouf = PlanPaiement.objects.get(pelerin__nom="DIOP")
    verifier(plan_youssouf.montant_paye == 625000, f"Youssouf : 625 000 payés (trouvé : {plan_youssouf.montant_paye})")
    verifier(plan_youssouf.reste_du == 1875000, f"Youssouf : reste dû 1 875 000 (trouvé : {plan_youssouf.reste_du})")

    tranche1_youssouf = plan_youssouf.tranches.get(numero_tranche=1)
    verifier(tranche1_youssouf.statut == "payee", f"Tranche 1 Youssouf = statut payée (trouvé : {tranche1_youssouf.statut})")

    # ------------------------------------------------------------------
    # Statuts de dossier calculés automatiquement
    # ------------------------------------------------------------------
    print("\n3. Statuts de dossier :")
    for pelerin in Pelerin.objects.all():
        documents_requis = pelerin.documents.exclude(statut="non_requis")
        attendu = "incomplet"
        if documents_requis.exists():
            if all(d.statut == "valide" for d in documents_requis):
                attendu = "valide"
            elif all(d.statut in ("soumis", "valide") for d in documents_requis):
                attendu = "complet"
        verifier(
            pelerin.statut_dossier == attendu,
            f"{pelerin.prenom} {pelerin.nom} : statut '{pelerin.statut_dossier}' attendu '{attendu}'",
        )

    # ------------------------------------------------------------------
    # Documents requis présents pour chaque pèlerin
    # ------------------------------------------------------------------
    print("\n4. Documents par pèlerin (4 requis chacun) :")
    for pelerin in Pelerin.objects.all():
        verifier(pelerin.documents.count() == 4, f"{pelerin.prenom} {pelerin.nom} : 4 documents (trouvé : {pelerin.documents.count()})")

    # ------------------------------------------------------------------
    # Conclusion
    # ------------------------------------------------------------------
    print("\n=== Résultat ===")
    if erreurs:
        print(f"{len(erreurs)} erreur(s) détectée(s) :")
        for e in erreurs:
            print(f"  - {e}")
        sys.exit(1)
    print("Toutes les vérifications sont passées.")


if __name__ == "__main__":
    main()