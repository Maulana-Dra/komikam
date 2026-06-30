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

        $commentsQuery = Comment::with([
            'user',
            'replies' => function ($query) {
                $query->withCount('likes')->where('status', '!=', 'deleted');
            },
            'replies.user',
            'replies.replyToUser'
        ])
        ->withCount('likes')
        ->whereNull('parent_id')
        ->where('manga_id', $mangaId)
        ->where('status', '!=', 'deleted');

        // Filter by chapter_id jika disediakan
        if ($request->query('chapter_id')) {
            $commentsQuery->where('chapter_id', $request->query('chapter_id'));
        } else {
            // Tampilkan komentar level manga (tanpa chapter_id) jika tidak ada filter
            $commentsQuery->whereNull('chapter_id');
        }

        if ($request->query('sort') === 'popular') {
            $commentsQuery->orderByDesc('likes_count')->orderByDesc('created_at');
        } elseif ($request->query('sort') === 'oldest') {
            $commentsQuery->orderBy('created_at');
        } else {
            $commentsQuery->orderByDesc('created_at');
        }

        $paginator = $commentsQuery->paginate(15);

        // Map data to append user liked status and custom formatted fields
        $items = $paginator->getCollection()->map(function ($comment) use ($userId) {
            $likedByMe = false;
            if ($userId) {
                $likedByMe = CommentLike::where('user_id', $userId)
                    ->where('comment_id', $comment->id)
                    ->exists();
            }

            $replies = $comment->replies->map(function ($reply) use ($userId) {
                $replyLikedByMe = false;
                if ($userId) {
                    $replyLikedByMe = CommentLike::where('user_id', $userId)
                        ->where('comment_id', $reply->id)
                        ->exists();
                }

                return [
                    'id' => $reply->id,
                    'user_id' => $reply->user_id,
                    'user_name' => $reply->user ? $reply->user->name : 'User Komikam',
                    'parent_id' => $reply->parent_id,
                    'reply_to_user_id' => $reply->reply_to_user_id,
                    'reply_to_username' => $reply->replyToUser ? $reply->replyToUser->name : null,
                    'manga_id' => $reply->manga_id,
                    'content' => $reply->content,
                    'status' => $reply->status,
                    'likes_count' => $reply->likes_count,
                    'liked_by_me' => $replyLikedByMe,
                    'created_at' => $reply->created_at->toIso8601String(),
                    'updated_at' => $reply->updated_at->toIso8601String(),
                ];
            });

            return [
                'id' => $comment->id,
                'user_id' => $comment->user_id,
                'user_name' => $comment->user ? $comment->user->name : 'User Komikam',
                'parent_id' => $comment->parent_id,
                'reply_to_user_id' => null,
                'reply_to_username' => null,
                'manga_id' => $comment->manga_id,
                'content' => $comment->content,
                'status' => $comment->status,
                'likes_count' => $comment->likes_count,
                'liked_by_me' => $likedByMe,
                'replies' => $replies,
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
            'content'    => ['required', 'string', 'min:1', 'max:100'],
            'chapter_id' => ['nullable', 'string', 'max:100'],
        ]);

        if ($this->containsProfanity($data['content'])) {
            return response()->json([
                'message' => 'Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.',
                'errors' => [
                    'content' => ['Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.']
                ]
            ], 422);
        }

        $comment = Comment::create([
            'user_id'    => $request->user()->id,
            'parent_id'  => null,
            'manga_id'   => $mangaId,
            'chapter_id' => $data['chapter_id'] ?? null,
            'content'    => $data['content'],
            'status'     => 'active',
        ]);

        $comment->load('user');

        return response()->json([
            'message' => 'Komentar berhasil ditambahkan.',
            'comment' => [
                'id' => $comment->id,
                'user_id' => $comment->user_id,
                'user_name' => $comment->user->name,
                'parent_id' => $comment->parent_id,
                'reply_to_user_id' => null,
                'reply_to_username' => null,
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
     * POST /api/comments/{commentId}/reply
     * Create a new reply to a comment.
     */
    public function storeReply(Request $request, int $commentId): JsonResponse
    {
        $comment = Comment::where('status', '!=', 'deleted')->find($commentId);
        if (!$comment) {
            return response()->json(['message' => 'Komentar tidak ditemukan.'], 404);
        }

        // Determine root parent ID (if target comment is a reply, use its parent_id, otherwise use its id)
        $rootParentId = $comment->parent_id ?: $comment->id;

        $data = $request->validate([
            'content' => ['required', 'string', 'min:1'],
            'reply_to_user_id' => ['nullable', 'exists:users,id'],
        ]);

        $replyToUserId = $data['reply_to_user_id'] ?? ($comment->parent_id ? $comment->user_id : null);
        $content = $data['content'];

        // Validate length of reply content, ignoring the '@username ' mention prefix
        $validationLength = mb_strlen($content);
        if ($replyToUserId) {
            $replyToUser = \App\Models\User::find($replyToUserId);
            if ($replyToUser) {
                $prefix = '@' . $replyToUser->name . ' ';
                if (str_starts_with($content, $prefix)) {
                    $validationLength = mb_strlen(substr($content, strlen($prefix)));
                }
            }
        }

        if ($validationLength > 100) {
            return response()->json([
                'message' => 'Balasan tidak boleh lebih dari 100 karakter.',
                'errors' => [
                    'content' => ['Balasan tidak boleh lebih dari 100 karakter.']
                ]
            ], 422);
        }

        if ($this->containsProfanity($content)) {
            return response()->json([
                'message' => 'Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.',
                'errors' => [
                    'content' => ['Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.']
                ]
            ], 422);
        }

        $reply = Comment::create([
            'user_id' => $request->user()->id,
            'parent_id' => $rootParentId,
            'reply_to_user_id' => $replyToUserId,
            'manga_id' => $comment->manga_id,
            'content' => $content,
            'status' => 'active',
        ]);

        $reply->load(['user', 'replyToUser']);

        return response()->json([
            'message' => 'Balasan berhasil ditambahkan.',
            'comment' => [
                'id' => $reply->id,
                'user_id' => $reply->user_id,
                'user_name' => $reply->user->name,
                'parent_id' => $reply->parent_id,
                'reply_to_user_id' => $reply->reply_to_user_id,
                'reply_to_username' => $reply->replyToUser ? $reply->replyToUser->name : null,
                'manga_id' => $reply->manga_id,
                'content' => $reply->content,
                'status' => $reply->status,
                'likes_count' => 0,
                'liked_by_me' => false,
                'created_at' => $reply->created_at->toIso8601String(),
                'updated_at' => $reply->updated_at->toIso8601String(),
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
     * DELETE /api/comments/{commentId}
     * Delete a comment. Only the owner can delete it.
     */
    public function destroy(Request $request, int $commentId): JsonResponse
    {
        $comment = Comment::find($commentId);
        if (!$comment) {
            return response()->json(['message' => 'Komentar tidak ditemukan.'], 404);
        }

        if ($comment->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Anda tidak memiliki akses untuk menghapus komentar ini.'], 403);
        }

        // Soft delete dengan mengganti status ke 'deleted'
        $comment->status = 'deleted';
        $comment->save();

        return response()->json([
            'message' => 'Komentar berhasil dihapus.'
        ]);
    }

    /**
     * Check if text contains profanity in Indonesian or English.
     */
    private function containsProfanity(?string $text): bool
    {
        if (empty($text)) {
            return false;
        }

        $profanityWords = [
            'anjing', 'babi', 'bangsat', 'bajingan', 'kontol', 'memek', 'pepek', 'ngentot', 'ngewe', 'pantek', 'perek', 'lonte', 'jembut', 'goblok', 'tolol', 'peler', 'itil', 'coli', 'asu', 'keparat', 'brengsek', 'pejuh',
            'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'bastard', 'dick', 'pussy', 'slut', 'whore', 'motherfucker'
        ];

        $specificSubstrings = [
            'anjing', 'kontol', 'memek', 'ngentot', 'ngewe', 'bajingan', 'goblok', 'tolol', 'jembut', 'lonte',
            'fuck', 'bitch', 'cunt', 'motherfucker', 'asshole'
        ];

        $normalized = strtolower($text);
        $normalized = str_replace(['0', '@'], 'a', $normalized);
        $normalized = str_replace(['1', '!'], 'i', $normalized);
        $normalized = str_replace('3', 'e', $normalized);
        $normalized = str_replace('$', 's', $normalized);
        $normalized = str_replace('5', 's', $normalized);

        // 1. Check direct word matches
        $words = preg_split('/[^a-z0-9]+/', $normalized);
        foreach ($words as $word) {
            if (in_array($word, $profanityWords)) {
                return true;
            }
        }

        // 2. Check for bypassed specific words
        $stripped = preg_replace('/[^a-z0-9]/', '', $normalized);
        foreach ($specificSubstrings as $badWord) {
            if (strpos($stripped, $badWord) !== false) {
                return true;
            }
        }

        return false;
    }
}
