<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\CommentLike;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    /**
     * GET /api/comments/{mangaId}
     * Get comments for a manga, paginated and sorted.
     */
    public function index(Request $request, string $mangaId): JsonResponse
    {
        $user = auth('sanctum')->user();
        $userId = $user ? $user->id : null;

        $commentsQuery = Comment::with(['user'])
            ->withCount('likes')
            ->where('manga_id', $mangaId)
            ->where('status', '!=', 'deleted');

        if ($request->query('sort') === 'popular') {
            $commentsQuery->orderByDesc('likes_count')->orderByDesc('created_at');
        } else {
            $commentsQuery->orderByDesc('created_at');
        }

        $paginator = $commentsQuery->paginate(10);

        // Map data to append user liked status and custom formatted fields
        $items = $paginator->getCollection()->map(function ($comment) use ($userId) {
            $likedByMe = false;
            if ($userId) {
                $likedByMe = CommentLike::where('user_id', $userId)
                    ->where('comment_id', $comment->id)
                    ->exists();
            }

            return [
                'id' => $comment->id,
                'user_id' => $comment->user_id,
                'user_name' => $comment->user ? $comment->user->name : 'User Komikam',
                'manga_id' => $comment->manga_id,
                'content' => $comment->content,
                'status' => $comment->status,
                'likes_count' => $comment->likes_count,
                'liked_by_me' => $likedByMe,
                'created_at' => $comment->created_at->toIso8601String(),
                'updated_at' => $comment->updated_at->toIso8601String(),
            ];
        });

        $paginator->setCollection($items);

        return response()->json($paginator);
    }

    /**
     * POST /api/comments/{mangaId}
     * Create a new comment.
     */
    public function store(Request $request, string $mangaId): JsonResponse
    {
        $data = $request->validate([
            'content' => ['required', 'string', 'min:1', 'max:200'],
        ]);

        $comment = Comment::create([
            'user_id' => $request->user()->id,
            'manga_id' => $mangaId,
            'content' => $data['content'],
            'status' => 'active',
        ]);

        $comment->load('user');

        return response()->json([
            'message' => 'Komentar berhasil ditambahkan.',
            'comment' => [
                'id' => $comment->id,
                'user_id' => $comment->user_id,
                'user_name' => $comment->user->name,
                'manga_id' => $comment->manga_id,
                'content' => $comment->content,
                'status' => $comment->status,
                'likes_count' => 0,
                'liked_by_me' => false,
                'created_at' => $comment->created_at->toIso8601String(),
                'updated_at' => $comment->updated_at->toIso8601String(),
            ]
        ], 201);
    }

    /**
     * POST /api/comments/{commentId}/like
     * Toggle like status on a comment.
     */
    public function like(Request $request, int $commentId): JsonResponse
    {
        $userId = $request->user()->id;

        $comment = Comment::where('status', '!=', 'deleted')->find($commentId);
        if (!$comment) {
            return response()->json(['message' => 'Komentar tidak ditemukan.'], 404);
        }

        $like = CommentLike::where('user_id', $userId)
            ->where('comment_id', $commentId)
            ->first();

        if ($like) {
            $like->delete();
            $liked = false;
            $message = 'Suka dibatalkan.';
        } else {
            CommentLike::create([
                'user_id' => $userId,
                'comment_id' => $commentId,
            ]);
            $liked = true;
            $message = 'Menyukai komentar.';
        }

        $likesCount = CommentLike::where('comment_id', $commentId)->count();

        return response()->json([
            'message' => $message,
            'liked' => $liked,
            'likes_count' => $likesCount,
        ]);
    }

    /**
     * POST /api/comments/{commentId}/report
     * Report a comment.
     */
    public function report(Request $request, int $commentId): JsonResponse
    {
        $comment = Comment::where('status', '!=', 'deleted')->find($commentId);
        if (!$comment) {
            return response()->json(['message' => 'Komentar tidak ditemukan.'], 404);
        }

        $comment->update(['status' => 'reported']);

        return response()->json([
            'message' => 'Komentar telah dilaporkan.',
            'status' => 'reported',
        ]);
    }
}
