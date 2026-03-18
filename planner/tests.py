from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from .models import Course, Task

User = get_user_model()


class TaskModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="yuzhuo", password="testpass123")
        self.course = Course.objects.create(user=self.user, name="Internet Technology", code="COMPSCI5012")

    def test_task_belongs_to_user_and_course(self):
        task = Task.objects.create(
            user=self.user,
            course=self.course,
            title="Write implementation report",
            deadline=timezone.localdate() + timedelta(days=3),
            priority=Task.PRIORITY_HIGH,
            status=Task.STATUS_TODO,
        )
        self.assertEqual(task.user, self.user)
        self.assertEqual(task.course, self.course)

    def test_is_overdue_false_for_future_task(self):
        task = Task.objects.create(
            user=self.user,
            title="Prepare video demo",
            deadline=timezone.localdate() + timedelta(days=1),
            priority=Task.PRIORITY_MEDIUM,
            status=Task.STATUS_TODO,
        )
        self.assertFalse(task.is_overdue)


class TaskViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="yuzhuo", password="testpass123")
        self.other_user = User.objects.create_user(username="other", password="otherpass123")
        self.course = Course.objects.create(user=self.user, name="Internet Technology", code="COMPSCI5012")
        self.other_course = Course.objects.create(user=self.other_user, name="Other Course", code="OTHER1")
        self.task = Task.objects.create(
            user=self.user,
            course=self.course,
            title="Implement dashboard",
            deadline=timezone.localdate() + timedelta(days=2),
            priority=Task.PRIORITY_HIGH,
            status=Task.STATUS_TODO,
        )
        self.client.login(username="yuzhuo", password="testpass123")

    def test_dashboard_requires_login(self):
        anon = Client()
        response = anon.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 302)

    def test_dashboard_shows_only_current_user_tasks(self):
        Task.objects.create(
            user=self.other_user,
            course=self.other_course,
            title="Hidden task",
            deadline=timezone.localdate() + timedelta(days=5),
            priority=Task.PRIORITY_LOW,
            status=Task.STATUS_TODO,
        )
        response = self.client.get(reverse("dashboard"))
        self.assertContains(response, "Implement dashboard")
        self.assertNotContains(response, "Hidden task")

    def test_create_task(self):
        response = self.client.post(
            reverse("task_create"),
            {
                "title": "Create tests",
                "deadline": timezone.localdate() + timedelta(days=4),
                "priority": Task.PRIORITY_MEDIUM,
                "course": self.course.pk,
                "status": Task.STATUS_PROGRESS,
                "description": "Write tests for CRUD and filtering.",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Task.objects.filter(user=self.user, title="Create tests").exists())

    def test_update_task(self):
        response = self.client.post(
            reverse("task_update", args=[self.task.pk]),
            {
                "title": "Implement dashboard page",
                "deadline": self.task.deadline,
                "priority": Task.PRIORITY_HIGH,
                "course": self.course.pk,
                "status": Task.STATUS_PROGRESS,
                "description": "Updated text",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, Task.STATUS_PROGRESS)
        self.assertEqual(self.task.title, "Implement dashboard page")

    def test_toggle_complete(self):
        response = self.client.post(reverse("task_toggle_complete", args=[self.task.pk]))
        self.assertEqual(response.status_code, 302)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, Task.STATUS_DONE)

    def test_delete_task(self):
        response = self.client.post(reverse("task_delete", args=[self.task.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Task.objects.filter(pk=self.task.pk).exists())

    def test_filter_by_course(self):
        second_course = Course.objects.create(user=self.user, name="AI", code="COMPSCI5002")
        Task.objects.create(
            user=self.user,
            course=second_course,
            title="AI task",
            deadline=timezone.localdate() + timedelta(days=7),
            priority=Task.PRIORITY_LOW,
            status=Task.STATUS_TODO,
        )
        response = self.client.get(reverse("dashboard"), {"course": self.course.pk})
        self.assertContains(response, "Implement dashboard")
        self.assertNotContains(response, "AI task")
