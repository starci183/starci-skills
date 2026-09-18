import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  it('br.task.single-owner: a task belongs to exactly one person, and only that person may complete or delete it', () => {
    const repository = new TaskRepository();
    const record = repository.create('owner-1', 'Ship it');

    expect(() => repository.complete(record.id, 'owner-2')).toThrow(expect.objectContaining({ code: 'TASK_FORBIDDEN' }));
    expect(() => repository.delete(record.id, 'owner-2')).toThrow(expect.objectContaining({ code: 'TASK_FORBIDDEN' }));
    expect(repository.findById(record.id).complete).toBe(false);
  });

  it('br.task.delete.final: deleting a task removes it; there is no recovery path', () => {
    const repository = new TaskRepository();
    const record = repository.create('owner-1', 'Ship it');

    repository.delete(record.id, 'owner-1');

    expect(() => repository.findById(record.id)).toThrow(expect.objectContaining({ code: 'TASK_NOT_FOUND' }));
  });

  it('ac.task.title.required.refuses-empty: a creation request with an empty or whitespace title is refused', () => {
    const repository = new TaskRepository();

    expect(() => repository.create('owner-1', '   ')).toThrow(expect.objectContaining({ code: 'TASK_TITLE_REQUIRED' }));
  });
});
