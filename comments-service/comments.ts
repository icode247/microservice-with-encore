// --- comments-service/comments.ts ---
import { api, Query } from "encore.dev/api";
import { posts } from "~encore/clients";

import { SQLDatabase } from "encore.dev/storage/sqldb";

// Database setup
const db = new SQLDatabase("comments", {
  migrations: "./migrations",
});

// Types
interface Comment {
  id: string;
  postId: string;
  content: string;
  authorName: string;
  createdAt: Date;
}

interface CreateCommentRequest {
  postId: string;
  content: string;
  authorName: string;
}

interface ListCommentsRequest {
  limit?: Query<number>;
  offset?: Query<number>;
  postId: string;
}

interface ListCommentsResponse {
  comments: Comment[];
}
// API Endpoints
export const createComment = api(
  {
    method: "POST",
    path: "/comments",
    expose: true,
  },
  async (req: CreateCommentRequest): Promise<Comment> => {
    // Verify post exists
    const post = await posts.getPost({ id: req.postId as string });
    if (!post) {
      throw new Error("Post not found");
    }

    return (await db.queryRow<Comment>`
            INSERT INTO comments (post_id, content, author_name)
            VALUES (${req.postId}, ${req.content}, ${req.authorName})
            RETURNING 
                id,
                post_id as "postId",
                content,
                author_name as "authorName",
                created_at as "createdAt"
        `) as Comment;
  }
);

export const listComments = api(
  {
    method: "GET",
    path: "/comments/:postId",
    expose: true,
  },
  async (params: ListCommentsRequest): Promise<ListCommentsResponse> => {
    const limit = params.limit || 10;
    const offset = params.offset || 0;

    const comments = await db.query<Comment>`
            SELECT
                id,
                post_id as "postId",
                content,
                author_name as "authorName",
                created_at as "createdAt"
            FROM comments
            WHERE post_id = ${params.postId}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

    const result: Comment[] = [];
    for await (const comment of comments) {
      result.push(comment);
    }
    return { comments: result };
  }
);
