const TASKS_KEY = 'studyTaskHubTasks';
const COURSES_KEY = 'studyTaskHubCourses';
const FLASH_KEY = 'studyTaskHubFlashMessage';
const SELECTED_TASK_KEY = 'studyTaskHubSelectedTaskId';
const EDIT_TASK_KEY = 'studyTaskHubEditTaskId';

const DEFAULT_COURSES = [
    {
        id: 'course-web',
        name: 'Web Development',
        code: 'WD601',
        description: 'Templates, client-side scripting, and full-stack integration.'
    },
    {
        id: 'course-db',
        name: 'Database Systems',
        code: 'DB420',
        description: 'Data modelling, schema planning, and query design.'
    },
    {
        id: 'course-ux',
        name: 'UX Design',
        code: 'UX215',
        description: 'Accessibility, interaction design, and evaluation workflows.'
    }
];

const DEFAULT_TASKS = [
    {
        id: 'task-1',
        title: 'Review accessibility checklist',
        description: 'Check labels, colour contrast, keyboard interaction support, and status messages.',
        dueDate: '2026-03-16',
        priority: 'Low',
        course: 'UX Design',
        status: 'done'
    },
    {
        id: 'task-2',
        title: 'Build Django base template',
        description: 'Complete the overall structure for base.html, the navigation bar, and the footer.',
        dueDate: '2026-03-18',
        priority: 'High',
        course: 'Web Development',
        status: 'todo'
    },
    {
        id: 'task-3',
        title: 'Draft ER notes',
        description: 'Organise lecture notes and update the database design outline.',
        dueDate: '2026-03-20',
        priority: 'Medium',
        course: 'Database Systems',
        status: 'progress'
    },
    {
        id: 'task-4',
        title: 'Prepare login validation',
        description: 'Add clearer login validation and error feedback for the authentication flow.',
        dueDate: '2026-03-22',
        priority: 'High',
        course: 'Web Development',
        status: 'todo'
    }
];

$(function () {
    initStorage();
    initGlobalFeedback();
    initFormValidation();
    initDashboardPage();
    initTaskFormPage();
    initTaskDetailPage();
    initCourseManagementPage();
});

function initStorage() {
    if (!loadCourses().length) {
        saveCourses(DEFAULT_COURSES);
    }

    if (!loadTasks().length) {
        saveTasks(DEFAULT_TASKS);
    }
}

function initGlobalFeedback() {
    const flashMessage = sessionStorage.getItem(FLASH_KEY);
    if (!flashMessage) {
        return;
    }

    const globalFeedback = $('#global-feedback');
    globalFeedback.removeClass('d-none').removeClass('alert-danger').addClass('alert-success').text(flashMessage);
    sessionStorage.removeItem(FLASH_KEY);
}

function initFormValidation() {
    $('[data-validate-form]').each((_, formElement) => {
        const $form = $(formElement);
        const $fields = $form.find('input, select, textarea');

        $fields.on('input change blur', function () {
            validateField($(this));
        });

        $form.on('submit', function (event) {
            event.preventDefault();
            const isValid = validateForm($form);

            if (!isValid) {
                const firstInvalidField = $form.find('.is-invalid').first();
                if (firstInvalidField.length) {
                    firstInvalidField.trigger('focus');
                }
                updateFormMessage($form, 'Please correct the errors in the form before continuing.', 'danger');
                return;
            }

            if ($form.is('[data-task-form-page-form]')) {
                handleTaskFormSubmit($form);
                return;
            }

            if ($form.is('[data-course-form]')) {
                handleCourseFormSubmit($form);
                return;
            }

            updateFormMessage($form, $form.data('success-message') || 'Form validation passed.', 'success');
        });
    });
}

function initDashboardPage() {
    const $dashboard = $('[data-dashboard-page]');
    if (!$dashboard.length) {
        return;
    }

    populateCourseFilter($dashboard.find('[data-course-filter]'));
    renderDashboardTasks();

    $dashboard.on('change', '[data-course-filter]', function () {
        renderDashboardTasks($(this).val());
    });

    $dashboard.on('click', '[data-toggle-preview]', function () {
        toggleTaskPreview($(this));
    });

    $dashboard.on('click', '[data-confirm-delete]', function () {

        const taskId = $(this).closest('[data-task-item]').data('task-id');
        if (!taskId) {
            return;
        }

        if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            deleteTask(taskId);
            renderDashboardTasks($dashboard.find('[data-course-filter]').val());
            showMessageBox($dashboard.find('[data-dashboard-message]'), 'Task deleted successfully.', 'success');
        }
    });

    $dashboard.on('click', '[data-toggle-complete]', function () {
        const taskId = $(this).closest('[data-task-item]').data('task-id');
        const updatedTask = toggleTaskCompletion(taskId);
        renderDashboardTasks($dashboard.find('[data-course-filter]').val());
        if (updatedTask) {
            const message = updatedTask.status === 'done' ? 'Task marked as completed.' : 'Task restored to its previous status.';
            showMessageBox($dashboard.find('[data-dashboard-message]'), message, 'success');
            attemptAjaxUpdate('task-status', updatedTask);
        }
    });

    $dashboard.on('click', '[data-edit-task-link]', function () {
        const taskId = $(this).closest('[data-task-item]').data('task-id');
        if (taskId) {
            sessionStorage.setItem(EDIT_TASK_KEY, taskId);
        }
    });

    $dashboard.on('click', '[data-view-task-link]', function () {
        const taskId = $(this).closest('[data-task-item]').data('task-id');
        if (taskId) {
            sessionStorage.setItem(SELECTED_TASK_KEY, taskId);
        }
    });
}

function initTaskFormPage() {
    const $page = $('[data-task-form-page]');
    if (!$page.length) {
        return;
    }

    populateCourseSelect($page.find('[data-course-select]'));

    const editingTaskId = sessionStorage.getItem(EDIT_TASK_KEY);
    if (!editingTaskId) {
        return;
    }

    const task = findTaskById(editingTaskId);
    if (!task) {
        return;
    }

    const $form = $page.find('[data-task-form-page-form]');
    $page.find('[data-task-form-heading]').text('Edit task');
    $form.find('[name="task_id"]').val(task.id);
    $form.find('[name="title"]').val(task.title);
    $form.find('[name="due_date"]').val(task.dueDate);
    $form.find('[name="priority"]').val(task.priority);
    $form.find('[name="course"]').val(task.course);
    $form.find('[name="status"]').val(task.status);
    $form.find('[name="description"]').val(task.description);
    updateFormMessage($form, 'Task details loaded. You can now edit and save the task.', 'success');
}

function initTaskDetailPage() {
    const $page = $('[data-task-detail-page]');
    if (!$page.length) {
        return;
    }

    renderTaskDetail($page);

    $page.on('click', '[data-edit-from-detail]', function () {
        const taskId = sessionStorage.getItem(SELECTED_TASK_KEY);
        if (taskId) {
            sessionStorage.setItem(EDIT_TASK_KEY, taskId);
        }
    });

    $page.on('click', '[data-toggle-complete-detail]', function () {
        const taskId = sessionStorage.getItem(SELECTED_TASK_KEY);
        const updatedTask = toggleTaskCompletion(taskId);
        if (updatedTask) {
            renderTaskDetail($page);
            const text = updatedTask.status === 'done' ? 'Task marked as completed.' : 'Task restored to its previous status.';
            showMessageBox($page.find('[data-detail-message]'), text, 'success');
            attemptAjaxUpdate('task-status', updatedTask);
        }
    });

    $page.on('click', '[data-delete-detail]', function () {
        const taskId = sessionStorage.getItem(SELECTED_TASK_KEY);
        if (!taskId) {
            return;
        }

        if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            deleteTask(taskId);
            sessionStorage.setItem(FLASH_KEY, 'Task deleted successfully.');
            sessionStorage.removeItem(SELECTED_TASK_KEY);
            window.location.href = $page.data('dashboard-url');

        }
    });
}

function initCourseManagementPage() {
    const $page = $('[data-course-page]');
    if (!$page.length) {
        return;
    }

    renderCourses();

    $page.on('click', '[data-toggle-course-form]', function () {
        const $button = $(this);
        const $panel = $page.find('[data-course-form-panel]');
        const shouldShow = $button.attr('aria-expanded') !== 'true';

        setCourseFormVisibility($panel, $button, shouldShow);

        if (shouldShow) {
            setTimeout(() => {
                const $firstField = $panel.find('input, textarea, select').first();
                if ($firstField.length) {
                    $firstField.trigger('focus');
                }
            }, 220);
        }
    });
}

function setCourseFormVisibility($panel, $button, shouldShow) {
    if (!$panel.length || !$button.length) {
        return;
    }

    if (shouldShow) {
        $panel.removeClass('d-none').hide().slideDown(180);
        $button.attr('aria-expanded', 'true').text('Hide Course Form');
        return;
    }

    $panel.stop(true, true).slideUp(180, () => {
        $panel.addClass('d-none');
    });
    $button.attr('aria-expanded', 'false').text('Create Course');
}


function validateForm($form) {
    return $form.find('input, select, textarea').toArray().every((field) => validateField($(field)));
}

function validateField($field) {
    if ($field.attr('type') === 'hidden' || $field.is(':disabled')) {
        return true;
    }

    const value = ($field.val() || '').toString().trim();
    const label = $field.data('label') || $field.attr('name') || 'This field';
    let error = '';

    if ($field.prop('required') && !value) {
        error = `${label} cannot be empty.`;
    } else if ($field.attr('type') === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        error = 'Please enter a valid email address.';
    } else if ($field.attr('minlength') && value.length && value.length < Number($field.attr('minlength'))) {
        error = `${label} must contain at least ${$field.attr('minlength')} characters.`;
    } else if ($field.data('match-selector')) {
        const matchedValue = $($field.data('match-selector')).val();
        if ((matchedValue || '').toString().trim() !== value) {
            error = $field.data('match-message') || `${label} does not match.`;
        }
    }

    setFieldState($field, error);
    return !error;
}

function setFieldState($field, error) {
    const $feedback = $field.closest('div').find('.invalid-feedback').first();
    const feedbackId = ensureFeedbackId($field, $feedback);
    const describedBy = new Set(($field.attr('aria-describedby') || '').split(/\s+/).filter(Boolean));

    $field.toggleClass('is-invalid', Boolean(error));
    $field.toggleClass('is-valid', !error && String($field.val() || '').trim() !== '');
    $field.attr('aria-invalid', error ? 'true' : 'false');

    if (feedbackId) {
        if (error) {
            describedBy.add(feedbackId);
            $field.attr('aria-errormessage', feedbackId);
        } else {
            describedBy.delete(feedbackId);
            $field.removeAttr('aria-errormessage');
        }
    }

    if (describedBy.size) {
        $field.attr('aria-describedby', Array.from(describedBy).join(' '));
    } else {
        $field.removeAttr('aria-describedby');
    }

    if ($feedback.length) {
        $feedback.text(error);
    }
}

function ensureFeedbackId($field, $feedback) {
    if (!$feedback.length) {
        return '';
    }

    if ($feedback.attr('id')) {
        return $feedback.attr('id');
    }

    const fieldId = $field.attr('id') || $field.attr('name') || 'field';
    const feedbackId = `${fieldId}-error`;
    $feedback.attr('id', feedbackId);
    return feedbackId;
}


function updateFormMessage($form, message, level) {
    const $messageBox = $form.parent().find('[data-form-message]').first();
    if (!$messageBox.length) {
        return;
    }

    showMessageBox($messageBox, message, level);
}

function showMessageBox($messageBox, message, level) {
    if (!$messageBox.length) {
        return;
    }

    if (!message) {
        $messageBox.addClass('d-none').removeClass('alert-success alert-danger alert-warning').text('');
        return;
    }

    $messageBox.removeClass('d-none alert-success alert-danger alert-warning').addClass(`alert-${level}`).text(message);
}

function handleTaskFormSubmit($form) {
    const taskData = {
        id: $form.find('[name="task_id"]').val() || `task-${Date.now()}`,
        title: $form.find('[name="title"]').val().trim(),
        dueDate: $form.find('[name="due_date"]').val(),
        priority: $form.find('[name="priority"]').val(),
        course: $form.find('[name="course"]').val() || 'Unassigned',
        status: $form.find('[name="status"]').val(),
        description: $form.find('[name="description"]').val().trim() || 'No additional description was provided.'
    };

    upsertTask(taskData);
    sessionStorage.setItem(FLASH_KEY, 'Task saved successfully.');
    sessionStorage.setItem(SELECTED_TASK_KEY, taskData.id);
    sessionStorage.removeItem(EDIT_TASK_KEY);
    updateFormMessage($form, $form.data('success-message') || 'Task saved successfully.', 'success');
    attemptAjaxUpdate('task-save', taskData);

    const redirectUrl = $form.data('redirect-url');
    if (redirectUrl) {
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 700);
    }
}

function handleCourseFormSubmit($form) {
    const courses = loadCourses();
    const course = {
        id: `course-${Date.now()}`,
        name: $form.find('[name="name"]').val().trim(),
        code: $form.find('[name="code"]').val().trim(),
        description: $form.find('[name="description"]').val().trim() || 'No description provided.'
    };

    courses.push(course);
    saveCourses(courses);
    $form[0].reset();
    clearValidationState($form);
    updateFormMessage($form, '', 'success');
    renderCourses();

    const $page = $('[data-course-page]').first();
    setCourseFormVisibility($page.find('[data-course-form-panel]'), $page.find('[data-toggle-course-form]'), false);
    showMessageBox($('[data-course-message]').first(), 'Course saved successfully.', 'success');
    attemptAjaxUpdate('course-save', course);
}


function renderDashboardTasks(selectedCourse = 'all') {
    const $taskList = $('[data-task-list]').first();
    if (!$taskList.length) {
        return;
    }

    const formUrl = $taskList.data('form-url');
    const detailUrl = $taskList.data('detail-url');
    const tasks = loadTasks()
        .sort((first, second) => new Date(first.dueDate) - new Date(second.dueDate))
        .filter((task) => selectedCourse === 'all' || task.course === selectedCourse);

    $taskList.empty();

    tasks.forEach((task) => {
        $taskList.append(createTaskCardMarkup(task, formUrl, detailUrl));
    });

    $('[data-empty-state]').toggleClass('d-none', tasks.length !== 0);
    $('[data-task-live]').text(`Showing ${tasks.length} tasks`);
    refreshTaskSummary(tasks);
}

function toggleTaskPreview($button) {
    const $card = $button.closest('[data-task-item]');
    const $preview = $card.find('[data-task-preview]').first();
    const isExpanded = $button.attr('aria-expanded') === 'true';

    if (!$preview.length) {
        return;
    }

    if (isExpanded) {
        $preview.stop(true, true).slideUp(160, () => {
            $preview.addClass('d-none');
        });
        $button.attr('aria-expanded', 'false').text('Quick View');
        return;
    }

    $preview.removeClass('d-none').hide().slideDown(180);
    $button.attr('aria-expanded', 'true').text('Hide Preview');
}

function renderCourses() {

    const $list = $('[data-course-list]').first();
    if (!$list.length) {
        return;
    }

    const courses = loadCourses();
    $list.empty();

    courses.forEach((course) => {
        $list.append(`
            <article class="course-card">
                <div class="d-flex justify-content-between gap-3 flex-wrap align-items-start">
                    <div>
                        <h3 class="h6 mb-1">${escapeHtml(course.name)}</h3>
                        <p class="small mb-2">${escapeHtml(course.code || 'No module code')}</p>
                        <p class="mb-0 text-secondary">${escapeHtml(course.description)}</p>
                    </div>
                </div>
            </article>
        `);
    });

    $('[data-course-empty]').toggleClass('d-none', courses.length !== 0);
    $('[data-course-count]').text(`${courses.length} courses`);
}

function renderTaskDetail($page) {
    const selectedTaskId = sessionStorage.getItem(SELECTED_TASK_KEY);
    const task = findTaskById(selectedTaskId) || loadTasks()[0];

    if (!task) {
        showMessageBox($page.find('[data-detail-message]'), 'No task is available to display.', 'warning');
        return;
    }

    sessionStorage.setItem(SELECTED_TASK_KEY, task.id);
    $page.find('[data-task-detail-title]').text(task.title);
    $page.find('[data-task-detail-course]').text(task.course || 'Unassigned');
    $page.find('[data-task-detail-priority]').removeClass('badge-soft-danger badge-soft-warning badge-soft-success').addClass(getPriorityBadgeClass(task.priority)).text(task.priority);
    $page.find('[data-task-detail-status]').text(formatStatusLabel(task.status));
    $page.find('[data-task-detail-due]').text(formatDueDateForDisplay(task.dueDate));
    $page.find('[data-task-detail-description]').text(task.description);
    $page.find('[data-toggle-complete-detail]').text(task.status === 'done' ? 'Restore Task' : 'Mark as Completed');
}

function refreshTaskSummary(tasks) {
    const counts = { todo: 0, progress: 0, done: 0 };
    tasks.forEach((task) => {
        counts[task.status] = (counts[task.status] || 0) + 1;
    });

    $('[data-summary="todo"]').text(String(counts.todo));
    $('[data-summary="progress"]').text(String(counts.progress));
    $('[data-summary="done"]').text(String(counts.done));
}

function populateCourseFilter($select) {
    if (!$select.length) {
        return;
    }

    const currentValue = $select.val() || 'all';
    $select.find('option:not([value="all"])').remove();
    loadCourses().forEach((course) => {
        $select.append(`<option value="${escapeHtml(course.name)}">${escapeHtml(course.name)}</option>`);
    });
    $select.val(currentValue);
}

function populateCourseSelect($select) {
    if (!$select.length) {
        return;
    }

    const currentValue = $select.val() || '';
    $select.find('option:not(:first)').remove();
    loadCourses().forEach((course) => {
        $select.append(`<option value="${escapeHtml(course.name)}">${escapeHtml(course.name)}</option>`);
    });
    $select.val(currentValue);
}

function toggleTaskCompletion(taskId) {
    const tasks = loadTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
        return null;
    }

    if (task.status === 'done') {
        task.status = task.previousStatus || 'todo';
        delete task.previousStatus;
    } else {
        task.previousStatus = task.status;
        task.status = 'done';
    }

    saveTasks(tasks);
    return task;
}

function deleteTask(taskId) {
    const tasks = loadTasks().filter((task) => task.id !== taskId);
    saveTasks(tasks);
}

function upsertTask(taskData) {
    const tasks = loadTasks();
    const index = tasks.findIndex((task) => task.id === taskData.id);

    if (index >= 0) {
        tasks[index] = taskData;
    } else {
        tasks.push(taskData);
    }

    saveTasks(tasks);
}

function findTaskById(taskId) {
    return loadTasks().find((task) => task.id === taskId) || null;
}

function loadTasks() {
    return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
}

function saveTasks(tasks) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function loadCourses() {
    return JSON.parse(localStorage.getItem(COURSES_KEY) || '[]');
}

function saveCourses(courses) {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

function attemptAjaxUpdate(action, payload) {
    const endpoint = $('body').data('ajax-endpoint');
    if (!endpoint) {
        return;
    }

    $.ajax({
        url: endpoint,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ action, payload })
    });
}

function clearValidationState($form) {
    $form.find('input, select, textarea').each((_, field) => {
        const $field = $(field);
        const errorMessageId = $field.attr('aria-errormessage');
        const describedBy = ($field.attr('aria-describedby') || '')
            .split(/\s+/)
            .filter((value) => value && value !== errorMessageId)
            .join(' ');

        $field.removeClass('is-invalid is-valid').attr('aria-invalid', 'false').removeAttr('aria-errormessage');

        if (describedBy) {
            $field.attr('aria-describedby', describedBy);
        } else {
            $field.removeAttr('aria-describedby');
        }
    });

    $form.find('.invalid-feedback').text('');
}


function getPriorityBadgeClass(priority) {
    if (priority === 'High') {
        return 'badge-soft-danger';
    }
    if (priority === 'Medium') {
        return 'badge-soft-warning';
    }
    return 'badge-soft-success';
}

function getPriorityDotClass(priority) {
    if (priority === 'High') {
        return 'priority-high';
    }
    if (priority === 'Medium') {
        return 'priority-medium';
    }
    return 'priority-low';
}

function formatStatusLabel(status) {
    if (status === 'todo') {
        return 'Pending';
    }
    if (status === 'progress') {
        return 'In Progress';
    }
    return 'Completed';
}

function formatDueDateForDisplay(value) {
    if (!value) {
        return 'No due date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function createTaskCardMarkup(task, formUrl, detailUrl) {
    const badgeClass = getPriorityBadgeClass(task.priority);
    const dotClass = getPriorityDotClass(task.priority);
    const isDone = task.status === 'done';
    const statusButtonText = isDone ? 'Restore' : 'Complete';
    const dueText = isDone ? 'Completed' : `Due: ${formatDueDateForDisplay(task.dueDate)}`;
    const previewId = `task-preview-${task.id}`;

    return `
        <article class="task-card${isDone ? ' is-complete' : ''}" data-task-item data-task-id="${escapeHtml(task.id)}">
            <div class="d-flex justify-content-between gap-3 flex-wrap">
                <div>
                    <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                        <span class="priority-dot ${dotClass}" aria-hidden="true"></span>
                        <span class="badge ${badgeClass}">${escapeHtml(task.priority)}</span>
                        <span class="badge text-bg-light">${escapeHtml(task.course || 'Unassigned')}</span>
                        <span class="badge text-bg-secondary">${escapeHtml(formatStatusLabel(task.status))}</span>
                    </div>
                    <h3 class="h5 mb-1"><a class="task-card-title" href="${detailUrl}" data-view-task-link>${escapeHtml(task.title)}</a></h3>
                    <p class="text-secondary mb-2">${escapeHtml(task.description)}</p>
                    <p class="small mb-0">${escapeHtml(dueText)}</p>
                </div>
                <div class="task-actions">
                    <button type="button" class="btn btn-outline-dark btn-sm" data-toggle-preview aria-expanded="false" aria-controls="${escapeHtml(previewId)}">Quick View</button>
                    <a href="${detailUrl}" class="btn btn-outline-primary btn-sm" data-view-task-link>Details</a>
                    <a href="${formUrl}" class="btn btn-outline-secondary btn-sm" data-edit-task-link>Edit</a>
                    <button type="button" class="btn btn-outline-success btn-sm" data-toggle-complete>${statusButtonText}</button>
                    <button type="button" class="btn btn-outline-danger btn-sm" data-confirm-delete>Delete</button>
                </div>
            </div>
            <section id="${escapeHtml(previewId)}" class="task-preview d-none" data-task-preview aria-label="Quick task preview">
                <div class="task-preview-grid">
                    <dl class="task-preview-card mb-0">
                        <dt>Due date</dt>
                        <dd>${escapeHtml(formatDueDateForDisplay(task.dueDate))}</dd>
                    </dl>
                    <dl class="task-preview-card mb-0">
                        <dt>Status flow</dt>
                        <dd>${escapeHtml(formatStatusLabel(task.status))}</dd>
                    </dl>
                    <dl class="task-preview-card mb-0">
                        <dt>Course link</dt>
                        <dd>${escapeHtml(task.course || 'Unassigned')}</dd>
                    </dl>
                </div>
            </section>
        </article>
    `;
}


function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
