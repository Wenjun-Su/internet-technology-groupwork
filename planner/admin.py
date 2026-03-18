from django.contrib import admin

from .models import Course, Task


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "user", "created_at")
    search_fields = ("name", "code", "user__username")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "course", "deadline", "priority", "status")
    list_filter = ("priority", "status", "deadline")
    search_fields = ("title", "description", "user__username", "course__name")
