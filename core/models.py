from django.db import models
from django.core.validators import MinValueValidator


# ---------------------------------------------------------------------------
# AGENCE & UTILISATEURS
# ---------------------------------------------------------------------------

class Agence(models.Model):
    nom = models.CharField(max_length=255)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    adresse = models.TextField(blank=True, null=True)
    logo = models.ImageField(upload_to="logos_agences/", blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Agence"
        verbose_name_plural = "Agences"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Utilisateur(models.Model):
    ROLE_CHOICES = [
        ("gerant", "Gérant"),
        ("agent", "Agent commercial"),
    ]

    agence = models.ForeignKey(Agence, on_delete=models.CASCADE, related_name="utilisateurs")
    nom = models.CharField(max_length=255)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="agent")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["nom"]

    def __str__(self):
        return f"{self.nom} ({self.agence.nom})"


# ---------------------------------------------------------------------------
# GROUPE & PELERIN
# ---------------------------------------------------------------------------

class Groupe(models.Model):
    TYPE_CHOICES = [
        ("hajj", "Hajj"),
        ("omra", "Omra"),
    ]

    agence = models.ForeignKey(Agence, on_delete=models.CASCADE, related_name="groupes")
    nom = models.CharField(max_length=255, help_text="Ex: Hajj 2027, Omra Ramadan 2027")
    type_voyage = models.CharField(max_length=10, choices=TYPE_CHOICES)
    date_depart = models.DateField()
    date_retour = models.DateField()
    nb_places_max = models.PositiveIntegerField(default=0)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Groupe"
        verbose_name_plural = "Groupes"
        ordering = ["-date_depart"]

    def __str__(self):
        return f"{self.nom} - {self.agence.nom}"

    @property
    def nb_pelerins_inscrits(self):
        return self.pelerins.count()


class Pelerin(models.Model):
    SEXE_CHOICES = [("M", "Homme"), ("F", "Femme")]
    STATUT_DOSSIER_CHOICES = [
        ("incomplet", "Incomplet"),
        ("complet", "Complet"),
        ("valide", "Validé"),
    ]

    groupe = models.ForeignKey(Groupe, on_delete=models.CASCADE, related_name="pelerins")
    nom = models.CharField(max_length=255)
    prenom = models.CharField(max_length=255)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    date_naissance = models.DateField(blank=True, null=True)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, blank=True, null=True)
    contact_urgence_nom = models.CharField(max_length=255, blank=True, null=True)
    contact_urgence_telephone = models.CharField(max_length=20, blank=True, null=True)
    statut_dossier = models.CharField(
        max_length=20, choices=STATUT_DOSSIER_CHOICES, default="incomplet"
    )
    date_inscription = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Pèlerin"
        verbose_name_plural = "Pèlerins"
        ordering = ["nom", "prenom"]

    def __str__(self):
        return f"{self.prenom} {self.nom}"

    def maj_statut_dossier(self):
        """Recalcule le statut du dossier selon les documents requis/soumis."""
        documents_requis = self.documents.exclude(statut="non_requis")
        if not documents_requis.exists():
            self.statut_dossier = "incomplet"
        elif all(doc.statut == "valide" for doc in documents_requis):
            self.statut_dossier = "valide"
        elif all(doc.statut in ("soumis", "valide") for doc in documents_requis):
            self.statut_dossier = "complet"
        else:
            self.statut_dossier = "incomplet"
        self.save(update_fields=["statut_dossier"])

    @property
    def photo(self):
        return self.documents.filter(type_document="photo").first()


# ---------------------------------------------------------------------------
# DOCUMENTS
# ---------------------------------------------------------------------------

class Document(models.Model):
    TYPE_CHOICES = [
        ("passeport", "Passeport"),
        ("visa", "Visa"),
        ("certificat_vaccination", "Certificat de vaccination"),
        ("photo", "Photo d'identité"),
        ("autre", "Autre"),
    ]
    STATUT_CHOICES = [
        ("manquant", "Manquant"),
        ("soumis", "Soumis"),
        ("valide", "Validé"),
        ("rejete", "Rejeté"),
    ]

    pelerin = models.ForeignKey(Pelerin, on_delete=models.CASCADE, related_name="documents")
    type_document = models.CharField(max_length=30, choices=TYPE_CHOICES)
    fichier = models.FileField(upload_to="documents_pelerins/", blank=True, null=True)
    date_expiration = models.DateField(blank=True, null=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="manquant")
    date_upload = models.DateTimeField(blank=True, null=True)

    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"
        unique_together = ("pelerin", "type_document")
        ordering = ["type_document"]

    def __str__(self):
        return f"{self.get_type_document_display()} - {self.pelerin}"


# ---------------------------------------------------------------------------
# PAIEMENTS
# ---------------------------------------------------------------------------

class PlanPaiement(models.Model):
    pelerin = models.OneToOneField(Pelerin, on_delete=models.CASCADE, related_name="plan_paiement")
    montant_total = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(0)])
    devise = models.CharField(max_length=10, default="FCFA")
    nombre_tranches = models.PositiveSmallIntegerField(default=1)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Plan de paiement"
        verbose_name_plural = "Plans de paiement"

    def __str__(self):
        return f"Plan de {self.pelerin} - {self.montant_total} {self.devise}"

    @property
    def montant_paye(self):
        return sum(t.montant_verse for t in self.tranches.all())

    @property
    def reste_du(self):
        return self.montant_total - self.montant_paye


class Tranche(models.Model):
    STATUT_CHOICES = [
        ("a_venir", "À venir"),
        ("payee", "Payée"),
        ("partielle", "Partiellement payée"),
        ("en_retard", "En retard"),
    ]

    plan_paiement = models.ForeignKey(PlanPaiement, on_delete=models.CASCADE, related_name="tranches")
    numero_tranche = models.PositiveSmallIntegerField()
    montant_prevu = models.DecimalField(max_digits=12, decimal_places=0)
    date_echeance = models.DateField()
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="a_venir")

    class Meta:
        verbose_name = "Tranche"
        verbose_name_plural = "Tranches"
        unique_together = ("plan_paiement", "numero_tranche")
        ordering = ["numero_tranche"]

    def __str__(self):
        return f"Tranche {self.numero_tranche} - {self.plan_paiement.pelerin}"

    @property
    def montant_verse(self):
        return sum(p.montant_paye for p in self.paiements.all())

    def maj_statut(self):
        from django.utils import timezone
        verse = self.montant_verse
        if verse >= self.montant_prevu:
            self.statut = "payee"
        elif verse > 0:
            self.statut = "partielle"
        elif self.date_echeance < timezone.now().date():
            self.statut = "en_retard"
        else:
            self.statut = "a_venir"
        self.save(update_fields=["statut"])


class Paiement(models.Model):
    MODE_CHOICES = [
        ("especes", "Espèces"),
        ("wave", "Wave"),
        ("orange_money", "Orange Money"),
        ("virement", "Virement bancaire"),
        ("autre", "Autre"),
    ]

    tranche = models.ForeignKey(Tranche, on_delete=models.CASCADE, related_name="paiements")
    montant_paye = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(0)])
    date_paiement = models.DateTimeField(auto_now_add=True)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default="especes")
    reference = models.CharField(max_length=255, blank=True, null=True)
    enregistre_par = models.ForeignKey(
        Utilisateur, on_delete=models.SET_NULL, null=True, related_name="paiements_enregistres"
    )

    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-date_paiement"]

    def __str__(self):
        return f"{self.montant_paye} {self.tranche.plan_paiement.devise} - {self.tranche}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.tranche.maj_statut()


# ---------------------------------------------------------------------------
# RAPPELS
# ---------------------------------------------------------------------------

class Rappel(models.Model):
    CANAL_CHOICES = [
        ("whatsapp", "WhatsApp"),
        ("sms", "SMS"),
    ]
    STATUT_ENVOI_CHOICES = [
        ("en_attente", "En attente"),
        ("envoye", "Envoyé"),
        ("echec", "Échec"),
    ]

    tranche = models.ForeignKey(
        Tranche, on_delete=models.CASCADE, related_name="rappels", blank=True, null=True
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="rappels", blank=True, null=True
    )
    canal = models.CharField(max_length=10, choices=CANAL_CHOICES, default="whatsapp")
    date_envoi_prevue = models.DateTimeField()
    date_envoi_reelle = models.DateTimeField(blank=True, null=True)
    statut_envoi = models.CharField(max_length=20, choices=STATUT_ENVOI_CHOICES, default="en_attente")

    class Meta:
        verbose_name = "Rappel"
        verbose_name_plural = "Rappels"
        ordering = ["-date_envoi_prevue"]

    def __str__(self):
        cible = self.tranche or self.document
        return f"Rappel {self.canal} - {cible}"