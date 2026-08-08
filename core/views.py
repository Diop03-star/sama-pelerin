from django.conf import settings
from django.http import FileResponse


def front(request):
    """Sert le frontend single-file (front.html) à la racine."""
    chemin = settings.BASE_DIR / "front.html"
    return FileResponse(open(chemin, "rb"), content_type="text/html; charset=utf-8")