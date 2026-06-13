<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    protected $fillable = [
        'user_id',
        'parent_id',
        'reply_to_user_id',
        'manga_id',
        'chapter_id',
        'content',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replyToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reply_to_user_id');
    }

    public function likes(): HasMany
    {
        return $this->hasMany(CommentLike::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }
}
