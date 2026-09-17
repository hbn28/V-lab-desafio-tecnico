<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('protocolo_counters', function (Blueprint $table) {
            $table->integer('ano')->primary();
            $table->integer('ultimo_numero')->default(0);
        });

        DB::statement('ALTER TABLE protocolo_counters ADD CONSTRAINT chk_ultimo_numero_positivo CHECK (ultimo_numero >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('protocolo_counters');
    }
};
