from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core import api
from core.views import front

router = DefaultRouter()
router.register("agences", api.AgenceViewSet, basename="agence")
router.register("groupes", api.GroupeViewSet, basename="groupe")
router.register("pelerins", api.PelerinViewSet, basename="pelerin")
router.register("documents", api.DocumentViewSet, basename="document")
router.register("tranches", api.TrancheViewSet, basename="tranche")
router.register("rappels", api.RappelViewSet, basename="rappel")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", front, name="front"),
    path(
        "api/v1/",
        include(
            [
                path("", include(router.urls)),
                path("dashboard/", api.dashboard, name="api-dashboard"),
                path("moi/", api.moi, name="api-moi"),
                path("csrf/", api.csrf_endpoint, name="api-csrf"),
                path("connexion/", api.api_login, name="api-login"),
                path("deconnexion/", api.api_logout, name="api-logout"),
            ]
        ),
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)