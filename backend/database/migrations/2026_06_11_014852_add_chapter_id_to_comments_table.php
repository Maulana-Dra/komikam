<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tambah kolom chapter_id (nullable) ke tabel comments.
     * NULL = komentar per manga (perilaku lama).
     * Berisi ID chapter = komentar per chapter.
     */
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->string('chapter_id', 100)->nullable()->after('manga_id')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn('chapter_id');
        });
    }
};
