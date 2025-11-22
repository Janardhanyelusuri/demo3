# app/core/task_manager.py

import threading
import uuid
from typing import Dict, Set

class TaskManager:
    """
    Simple in-memory task manager to track and cancel running LLM analysis tasks.
    """
    def __init__(self):
        self._active_tasks: Dict[str, dict] = {}
        self._cancelled_tasks: Set[str] = set()
        self._lock = threading.Lock()

    def create_task(self, task_type: str, metadata: dict = None) -> str:
        """Create a new task and return its ID."""
        task_id = str(uuid.uuid4())
        with self._lock:
            self._active_tasks[task_id] = {
                'id': task_id,
                'type': task_type,
                'metadata': metadata or {},
                'status': 'running'
            }
        print(f"✅ Created task {task_id} ({task_type})")
        return task_id

    def cancel_task(self, task_id: str) -> bool:
        """Mark a task as cancelled."""
        with self._lock:
            if task_id in self._active_tasks:
                self._cancelled_tasks.add(task_id)
                self._active_tasks[task_id]['status'] = 'cancelled'
                print(f"🛑 Cancelled task {task_id}")
                return True
            return False

    def cancel_tasks_by_project(self, project_id: str) -> int:
        """Cancel all tasks for a given project. Returns count of cancelled tasks."""
        cancelled_count = 0
        with self._lock:
            for task_id, task in list(self._active_tasks.items()):
                # Check if this task belongs to the project
                if task.get('metadata', {}).get('project_id') == project_id:
                    if task['status'] == 'running':
                        self._cancelled_tasks.add(task_id)
                        self._active_tasks[task_id]['status'] = 'cancelled'
                        print(f"🛑 Cancelled task {task_id} for project {project_id}")
                        cancelled_count += 1

        if cancelled_count > 0:
            print(f"✅ Cancelled {cancelled_count} task(s) for project {project_id}")
        else:
            print(f"ℹ️  No active tasks found for project {project_id}")

        return cancelled_count

    def is_cancelled(self, task_id: str) -> bool:
        """Check if a task has been cancelled."""
        with self._lock:
            return task_id in self._cancelled_tasks

    def complete_task(self, task_id: str):
        """Mark a task as completed and clean up."""
        with self._lock:
            if task_id in self._active_tasks:
                self._active_tasks[task_id]['status'] = 'completed'
                print(f"✅ Completed task {task_id}")
            # Clean up cancelled flag
            self._cancelled_tasks.discard(task_id)

    def get_task_status(self, task_id: str) -> dict:
        """Get task status."""
        with self._lock:
            return self._active_tasks.get(task_id, {'status': 'not_found'})

    def list_active_tasks(self) -> list:
        """List all active tasks."""
        with self._lock:
            return list(self._active_tasks.values())

    def cleanup_completed_tasks(self):
        """Remove completed tasks from registry."""
        with self._lock:
            completed_ids = [
                task_id for task_id, task in self._active_tasks.items()
                if task['status'] in ['completed', 'cancelled']
            ]
            for task_id in completed_ids:
                del self._active_tasks[task_id]
                self._cancelled_tasks.discard(task_id)

# Global singleton instance
task_manager = TaskManager()
