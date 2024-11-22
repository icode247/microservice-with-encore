// --- posts-service/posts.ts ---
import { api, Query } from "encore.dev/api";
import { Topic } from "encore.dev/pubsub";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Database setup
const db = new SQLDatabase("posts", {
  migrations: "./migrations",
});

interface PostEvent {
  id: string;
  title: string;
  authorName: string;
  action: "created" | "updated" | "deleted";
}
export const postCreatedTopic = new Topic<PostEvent>("post-created", {
  deliveryGuarantee: "at-least-once",
});

// Types
interface Post {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: Date;
}

interface CreatePostRequest {
  title: string;
  content: string;
  authorName: string;
}

interface ListPostsRequest {
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListPostsResponse {
  posts: Post[];
  total: number;
}

// API Endpoints
export const createPost = api(
  {
    method: "POST",
    path: "/posts",
    expose: true,
  },
  async (req: CreatePostRequest): Promise<Post> => {
    const post = await db.queryRow<Post>`
            INSERT INTO posts (title, content, author_name)
            VALUES (${req.title}, ${req.content}, ${req.authorName})
            RETURNING 
                id,
                title,
                content,
                author_name as "authorName",
                created_at as "createdAt"
        `;

    await postCreatedTopic.publish({
      id: post?.id as string,
      title: post?.title as string,
      authorName: post?.authorName as string,
      action: "created",
    });
    return post as Post;
  }
);

export const getPost = api(
  {
    method: "GET",
    path: "/posts/:id",
    expose: true,
  },
  async (params: { id: string }): Promise<Post> => {
    return (await db.queryRow<Post>`
            SELECT 
                id,
                title,
                content,
                author_name as "authorName",
                created_at as "createdAt"
            FROM posts 
            WHERE id = ${params.id}
        `) as Post;
  }
);

export const listPosts = api(
  {
    method: "GET",
    path: "/posts",
    expose: true,
  },
  async (params: ListPostsRequest): Promise<ListPostsResponse> => {
    const limit = params.limit || 10;
    const offset = params.offset || 0;

    // Get total count
    const totalResult = await db.queryRow<{ count: string }>`
            SELECT COUNT(*) as count FROM posts
        `;
    const total = parseInt(totalResult?.count || "0");

    // Get paginated posts
    const posts = await db.query<Post>`
            SELECT 
                id,
                title,
                content,
                author_name as "authorName",
                created_at as "createdAt"
            FROM posts
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

    const result: Post[] = [];
    for await (const post of posts) {
      result.push(post);
    }

    return {
      posts: result,
      total,
    };
  }
);
