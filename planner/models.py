from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Course(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="courses",
    )
    code = models.CharField(max_length=20, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("user", "name", "code")

    def __str__(self) -> str:
        return f"{self.code} - {self.name}" if self.code else self.name


class Task(models.Model):
    STATUS_TODO = "todo"
    STATUS_PROGRESS = "progress"
    STATUS_DONE = "done"
    STATUS_CHOICES = [
        (STATUS_TODO, "To Do"),
        (STATUS_PROGRESS, "In Progress"),
        (STATUS_DONE, "Completed"),
    ]
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_TODO,
    )
    PRIORITY_HIGH = "High"
    PRIORITY_MEDIUM = "Medium"
    PRIORITY_LOW = "Low"
    PRIORITY_CHOICES = [
        (PRIORITY_HIGH, "High"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_LOW, "Low"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    deadline = models.DateField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_TODO)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["deadline", "created_at"]

    def __str__(self) -> str:
        return self.title

    def clean(self) -> None:
        if self.course and self.course.user_id != self.user_id:
            raise ValidationError("Selected course does not belong to this user.")

    @property
    def is_overdue(self) -> bool:
        return self.status != self.STATUS_DONE and self.deadline < timezone.localdate()
