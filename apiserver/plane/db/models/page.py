import uuid

from django.conf import settings
from django.utils import timezone

# Django imports
from django.db import models

# Module imports
from plane.utils.html_processor import strip_tags

from .project import ProjectBaseModel
from .base import BaseModel


def get_view_props():
    return {"full_width": False}


class Page(BaseModel):
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="pages"
    )
    name = models.CharField(max_length=255, blank=True)
    description = models.JSONField(default=dict, blank=True)
    description_binary = models.BinaryField(null=True)
    description_html = models.TextField(blank=True, default="<p></p>")
    description_stripped = models.TextField(blank=True, null=True)
    owned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pages",
    )
    access = models.PositiveSmallIntegerField(
        choices=((0, "Public"), (1, "Private")), default=0
    )
    color = models.CharField(max_length=255, blank=True)
    labels = models.ManyToManyField(
        "db.Label", blank=True, related_name="pages", through="db.PageLabel"
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="child_page",
    )
    archived_at = models.DateField(null=True)
    is_locked = models.BooleanField(default=False)
    view_props = models.JSONField(default=get_view_props)
    logo_props = models.JSONField(default=dict)
    is_global = models.BooleanField(default=False)
    projects = models.ManyToManyField(
        "db.Project", related_name="pages", through="db.ProjectPage"
    )
    teams = models.ManyToManyField(
        "db.Team", related_name="pages", through="db.TeamPage"
    )

    class Meta:
        verbose_name = "Page"
        verbose_name_plural = "Pages"
        db_table = "pages"
        ordering = ("-created_at",)

    def __str__(self):
        """Return owner email and page name"""
        return f"{self.owned_by.email} <{self.name}>"

    def save(self, *args, **kwargs):
        # Strip the html tags using html parser
        self.description_stripped = (
            None
            if (self.description_html == "" or self.description_html is None)
            else strip_tags(self.description_html)
        )
        super(Page, self).save(*args, **kwargs)


class PageLog(BaseModel):
    TYPE_CHOICES = (
        ("to_do", "To Do"),
        ("issue", "issue"),
        ("image", "Image"),
        ("video", "Video"),
        ("file", "File"),
        ("link", "Link"),
        ("cycle", "Cycle"),
        ("module", "Module"),
        ("back_link", "Back Link"),
        ("forward_link", "Forward Link"),
        ("page_mention", "Page Mention"),
        ("user_mention", "User Mention"),
    )
    transaction = models.UUIDField(default=uuid.uuid4)
    page = models.ForeignKey(
        Page, related_name="page_log", on_delete=models.CASCADE
    )
    entity_identifier = models.UUIDField(null=True)
    entity_name = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        verbose_name="Transaction Type",
    )
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="workspace_page_log",
    )

    class Meta:
        unique_together = ["page", "transaction"]
        verbose_name = "Page Log"
        verbose_name_plural = "Page Logs"
        db_table = "page_logs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.page.name} {self.entity_name}"


# DEPRECATED TODO: - Remove in next release
class PageBlock(ProjectBaseModel):
    page = models.ForeignKey(
        "db.Page", on_delete=models.CASCADE, related_name="blocks"
    )
    name = models.CharField(max_length=255)
    description = models.JSONField(default=dict, blank=True)
    description_html = models.TextField(blank=True, default="<p></p>")
    description_stripped = models.TextField(blank=True, null=True)
    issue = models.ForeignKey(
        "db.Issue", on_delete=models.SET_NULL, related_name="blocks", null=True
    )
    completed_at = models.DateTimeField(null=True)
    sort_order = models.FloatField(default=65535)
    sync = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if self._state.adding:
            largest_sort_order = PageBlock.objects.filter(
                project=self.project, page=self.page
            ).aggregate(largest=models.Max("sort_order"))["largest"]
            if largest_sort_order is not None:
                self.sort_order = largest_sort_order + 10000

        # Strip the html tags using html parser
        self.description_stripped = (
            None
            if (self.description_html == "" or self.description_html is None)
            else strip_tags(self.description_html)
        )

        if self.completed_at and self.issue:
            try:
                from plane.db.models import Issue, State

                completed_state = State.objects.filter(
                    group="completed", project=self.project
                ).first()
                if completed_state is not None:
                    Issue.objects.update(
                        pk=self.issue_id, state=completed_state
                    )
            except ImportError:
                pass
        super(PageBlock, self).save(*args, **kwargs)

    class Meta:
        verbose_name = "Page Block"
        verbose_name_plural = "Page Blocks"
        db_table = "page_blocks"
        ordering = ("-created_at",)

    def __str__(self):
        """Return page and page block"""
        return f"{self.page.name} <{self.name}>"


# DEPRECATED TODO: - Remove in next release
class PageFavorite(ProjectBaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="page_favorites",
    )
    page = models.ForeignKey(
        "db.Page", on_delete=models.CASCADE, related_name="page_favorites"
    )

    class Meta:
        unique_together = ["page", "user"]
        verbose_name = "Page Favorite"
        verbose_name_plural = "Page Favorites"
        db_table = "page_favorites"
        ordering = ("-created_at",)

    def __str__(self):
        """Return user and the page"""
        return f"{self.user.email} <{self.page.name}>"


class PageLabel(BaseModel):
    label = models.ForeignKey(
        "db.Label", on_delete=models.CASCADE, related_name="page_labels"
    )
    page = models.ForeignKey(
        "db.Page", on_delete=models.CASCADE, related_name="page_labels"
    )
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="workspace_page_label",
    )

    class Meta:
        verbose_name = "Page Label"
        verbose_name_plural = "Page Labels"
        db_table = "page_labels"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.page.name} {self.label.name}"


class ProjectPage(BaseModel):
    project = models.ForeignKey(
        "db.Project", on_delete=models.CASCADE, related_name="project_pages"
    )
    page = models.ForeignKey(
        "db.Page", on_delete=models.CASCADE, related_name="project_pages"
    )
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="project_pages"
    )

    class Meta:
        unique_together = ["project", "page", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "page"],
                condition=models.Q(deleted_at__isnull=True),
                name="project_page_unique_project_page_when_deleted_at_null",
            )
        ]
        verbose_name = "Project Page"
        verbose_name_plural = "Project Pages"
        db_table = "project_pages"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.project.name} {self.page.name}"


class TeamPage(BaseModel):
    team = models.ForeignKey(
        "db.Team", on_delete=models.CASCADE, related_name="team_pages"
    )
    page = models.ForeignKey(
        "db.Page", on_delete=models.CASCADE, related_name="team_pages"
    )
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="team_pages"
    )

    class Meta:
        unique_together = ["team", "page", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "page"],
                condition=models.Q(deleted_at__isnull=True),
                name="team_page_unique_team_page_when_deleted_at_null",
            )
        ]
        verbose_name = "Team Page"
        verbose_name_plural = "Team Pages"
        db_table = "team_pages"
        ordering = ("-created_at",)


class PageVersion(BaseModel):
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="page_versions",
    )
    page = models.ForeignKey(
        "db.Page",
        on_delete=models.CASCADE,
        related_name="page_versions",
    )
    last_saved_at = models.DateTimeField(default=timezone.now)
    owned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="page_versions",
    )
    description_binary = models.BinaryField(null=True)
    description_html = models.TextField(blank=True, default="<p></p>")
    description_stripped = models.TextField(blank=True, null=True)
    description_json = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Page Version"
        verbose_name_plural = "Page Versions"
        db_table = "page_versions"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        # Strip the html tags using html parser
        self.description_stripped = (
            None
            if (self.description_html == "" or self.description_html is None)
            else strip_tags(self.description_html)
        )
        super(PageVersion, self).save(*args, **kwargs)
