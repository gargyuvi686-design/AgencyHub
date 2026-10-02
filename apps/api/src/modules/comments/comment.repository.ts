import { BaseRepository } from '../../lib/baseRepository';

export class CommentRepository extends BaseRepository {
  async listByTask(taskId: string): Promise<any[]> {
    return this.db.taskComment.findMany({
      where: {
        taskId,
        agencyId: this.agencyId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(taskId: string, authorId: string, body: string): Promise<any> {
    return this.db.taskComment.create({
      data: {
        agencyId: this.agencyId,
        taskId,
        authorId,
        body,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}
