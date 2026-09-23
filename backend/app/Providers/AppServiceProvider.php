<?php

namespace App\Providers;

use App\Domain\Solicitacoes\Events\SolicitacaoStatusAtualizado;
use App\Domain\Solicitacoes\Listeners\CriarNotificacoesOperacionais;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(SolicitacaoStatusAtualizado::class, CriarNotificacoesOperacionais::class);
    }
}
