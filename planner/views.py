from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import CourseForm, TaskForm
from .models import Course, Task


def _user_tasks(request: HttpRequest):
    return Task.objects.filter(user=request.user).select_related("course").order_by("deadline", "created_at")


@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
    course_id = request.GET.get("course")
    tasks = _user_tasks(request)
    if course_id:
        tasks = tasks.filter(course_id=course_id)

    summary = _user_tasks(request).aggregate(
        todo_count=Count("id", filter=None),
    )
    context = {
        "tasks": tasks,
        "courses": Course.objects.filter(user=request.user).order_by("name"),
        "selected_course": course_id or "",
        "todo_count": _user_tasks(request).filter(status=Task.STATUS_TODO).count(),
        "progress_count": _user_tasks(request).filter(status=Task.STATUS_PROGRESS).count(),
        "done_count": _user_tasks(request).filter(status=Task.STATUS_DONE).count(),
        "task_count": tasks.count(),
        "summary": summary,
    }
    return render(request, "dashboard.html", context)


@login_required
def task_create(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = TaskForm(request.POST, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Task created successfully.")
            return redirect("dashboard")
    else:
        form = TaskForm(user=request.user)

    return render(
        request,
        "tasks/task_form.html",
        {
            "form": form,
            "page_mode": "create",
        },
    )


@login_required
def task_detail(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task.objects.select_related("course"), pk=pk, user=request.user)
    return render(request, "tasks/task_detail.html", {"task": task})


@login_required
def task_update(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task, pk=pk, user=request.user)
    if request.method == "POST":
        form = TaskForm(request.POST, instance=task, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Task updated successfully.")
            return redirect("task_detail", pk=task.pk)
    else:
        form = TaskForm(instance=task, user=request.user)

    return render(
        request,
        "tasks/task_form.html",
        {
            "form": form,
            "page_mode": "edit",
            "task": task,
        },
    )


@login_required
@require_POST
def task_delete(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task, pk=pk, user=request.user)
    task.delete()
    messages.success(request, "Task deleted successfully.")
    return redirect("dashboard")


@login_required
@require_POST
def task_toggle_complete(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task, pk=pk, user=request.user)
    task.status = Task.STATUS_DONE if task.status != Task.STATUS_DONE else Task.STATUS_TODO
    task.save(update_fields=["status", "updated_at"])
    messages.success(
        request,
        "Task marked as completed." if task.status == Task.STATUS_DONE else "Task restored to pending.",
    )
    return redirect("task_detail", pk=task.pk)


@login_required
def course_management(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = CourseForm(request.POST)
        if form.is_valid():
            course = form.save(commit=False)
            course.user = request.user
            course.save()
            messages.success(request, "Course created successfully.")
            return redirect("course_management")
    else:
        form = CourseForm()

    return render(
        request,
        "courses/course_management.html",
        {
            "form": form,
            "courses": Course.objects.filter(user=request.user).order_by("name"),
        },
    )
