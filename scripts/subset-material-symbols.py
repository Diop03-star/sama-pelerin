# Subset de la police Material Symbols Outlined pour SamaPèlerin.
#
# La police complète (3,96 Mo) est trop lourde pour le mobile : sur réseau lent,
# font-display: swap affiche les noms d'icônes en texte brut pendant le chargement.
# Ce script génère un subset contenant uniquement les icônes utilisées par l'app.
#
# Mécanisme de la police : les icônes sont des LIGATURES GSUB (rlig) sur les
# noms d'icônes ; le rendu passe par la substitution de la séquence de lettres.
# pyftsubset --text seul ne suffit pas : le closure des ligatures à composantes
# lettre-par-lettre retient toutes les icônes composées de ces lettres.
#
# Marche à suivre :
#  1. Élaguer les LigatureSubst pour ne garder que les icônes de la liste.
#  2. Supprimer le lookup SingleSubst (variantes .fill) — inutile : FILL est un
#     axe variable de la police (font-variation-settings), pas une substitution.
#  3. pyftsubset --text avec les noms d'icônes pour ne garder que le nécessaire.
#
# Pour ajouter une icône : l'ajouter à ICONES ci-dessous, relancer :
#   python scripts/subset-material-symbols.py
# Puis vérifier le rendu (toutes les icônes de la liste) avant de committer.

import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

SOURCE = Path('scripts/fonts/material-symbols-outlined-complet.woff2')
SORTIE = Path('public/fonts/material-symbols-outlined.woff2')

# Toute icône utilisée dans src/ (Icon name=..., props icon=..., maps de données).
# Ne pas modifier sans vérifier le rendu de chaque icône de la liste.
ICONES = [
    'account_balance_wallet', 'add', 'admin_panel_settings', 'arrow_forward',
    'assignment_late', 'badge', 'block', 'business', 'calendar_month', 'call',
    'check', 'check_circle', 'chevron_right', 'close', 'cloud_done',
    'contact_emergency', 'dashboard', 'delete', 'description', 'download',
    'edit', 'error', 'event_note', 'event_seat', 'flight', 'folder_open',
    'group', 'group_add', 'groups', 'help_outline', 'lock', 'logout',
    'medical_information', 'menu', 'more_vert', 'mosque', 'notifications',
    'notifications_active', 'payments', 'person', 'person_add', 'photo_camera',
    'play_circle', 'request_quote', 'save', 'savings', 'schedule', 'search',
    'settings', 'trending_down', 'trending_up', 'upload_file', 'verified',
    'verified_user', 'visibility', 'warning',
]

SOUS_TRAITANCE = {'underscore': '_', 'digit_zero': '0', 'digit_one': '1',
                  'digit_two': '2', 'digit_three': '3', 'digit_four': '4',
                  'digit_five': '5', 'digit_six': '6', 'digit_seven': '7',
                  'digit_eight': '8', 'digit_nine': '9'}


def nom_ligature(premiere_lettre, composantes):
    return premiere_lettre + ''.join(SOUS_TRAITANCE.get(c, c) for c in composantes)


def elaguer_ligatures(font, icones):
    gsub = font['GSUB']
    lookup = gsub.table.LookupList.Lookup[0]
    gardees = 0
    for sub in lookup.SubTable:
        ligatures = sub.ExtSubTable.ligatures
        for premiere_lettre, entrees in list(ligatures.items()):
            filtres = [e for e in entrees if nom_ligature(premiere_lettre, e.Component) in icones]
            if filtres:
                ligatures[premiere_lettre] = filtres
                gardees += len(filtres)
            else:
                del ligatures[premiere_lettre]
    return gardees


def supprimer_lookup_fill(gsub):
    # Lookup 1 = SingleSubst icône -> variante .fill, jamais référencée
    # (rclt -> [], rlig -> [0]) et inutile : FILL est un axe variable.
    lookups = gsub.table.LookupList.Lookup
    assert len(lookups) == 2, 'structure GSUB inattendue, inspecter avant de supprimer'
    del lookups[1]


def main():
    police = TTFont(SOURCE)
    gsub = police['GSUB']
    nb = elaguer_ligatures(police, set(ICONES))
    if nb != len(ICONES):
        sys.exit(f'ERREUR: {len(ICONES) - nb} icône(s) de la liste sans ligature — '
                 'nom inconnu de la police ou coquille dans ICONES')
    supprimer_lookup_fill(gsub)
    intermediaire = Path('public/fonts/_tmp-material-symbols.ttf')
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    police.save(intermediaire)
    try:
        subprocess.run([
            sys.executable, '-m', 'fontTools.subset',
            str(intermediaire),
            '--output-file=' + str(SORTIE),
            '--flavor=woff2',
            '--layout-features=*',
            '--text=' + ' '.join(ICONES),
        ], check=True)
    finally:
        intermediaire.unlink(missing_ok=True)

    taille = SORTIE.stat().st_size
    print(f'{len(ICONES)} icônes, {nb} ligatures gardées, sortie {SORTIE} ({taille} octets)')


if __name__ == '__main__':
    main()
