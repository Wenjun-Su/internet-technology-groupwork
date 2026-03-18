from django import forms

from .models import Course, Task


class DateInput(forms.DateInput):
    input_type = "date"

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("format", "%Y-%m-%d")
        super().__init__(*args, **kwargs)

class CourseForm(forms.ModelForm):
    class Meta:
        model = Course
        fields = ["name", "code", "description"]


class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ["title", "deadline", "priority", "course", "status", "description"]
        widgets = {
            "deadline": DateInput(format="%Y-%m-%d"),
            "description": forms.Textarea(attrs={"rows": 5}),
        }

    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user")
        super().__init__(*args, **kwargs)
        self.instance.user = user
        self.fields["course"].queryset = Course.objects.filter(user=user).order_by("name")
        self.fields["course"].required = False
        self.user = user

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.user = self.user
        if commit:
            instance.save()
            self.save_m2m()
        return instance
