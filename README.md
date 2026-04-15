# Projektovy system fondu

Jednoducha webova aplikace pro evidenci fondu.

## Funkce
- Prvotni obrazovka prihlaseni (uzivatelske jmeno + heslo)
- Horni menu se sekcemi Fondy, Uzivatele a Workflows
- Grid se sloupci Nazev fondu a Stav
- Tlacitko PRIDANI FONDU vpravo nad gridem
- Dialog pro zadani noveho fondu
- Prepinani stavu primo v gridu (ONBOARDING, READY, OFFBOARDING)
- Obrazovka Uzivatele s datagridem: Uzivatelske jmeno, Heslo, Stav, Akce
- Pridani uzivatele pres modal (uzivatelske jmeno + heslo)
- Editace uzivatele pres modal (bez mazani)
- Deaktivace/Aktivace uzivatele pres tlacitko v datagridu
- Deaktivovany uzivatel se nemuze prihlasit
- Obrazovka Workflows s datagridem a tlacitkem PRIDANI WORKFLOW
- Klik na nazev workflow otevre detail workflow editor
- Workflow lze skladat z itemu Delay, Task a Task group
- Pro task i task group lze definovat navazujici tasky (vyberem existujicich tasku)
- Klik na fond otevre detail fondu s workflow runy
- Workflow run lze spustit okamzite, naplanovat na datum nebo periodicky (X mesic, Y den)
- Workflow runy maji stavy NAPLANOVANO NA DATUM, SPUSTENO, DOKONCENO
- Klik na workflow run zobrazi jeho vygenerovane tasky s deadline datem
- Tasky se oteviraji pres detail tasku
- V detailu tasku lze upravit stav, zapisovat poznamky a spravovat prilohy
- Prilohy ukladaji metadata: nazev souboru, kdo nahral, kdy a velikost
- Lze smazat cely workflow run vcetne jeho tasku
- Data se ukladaji do localStorage a zustavaji po restartu prohlizece

## Spusteni
1. Otevrete soubor index.html v prohlizeci.

## Prihlaseni
- Uzivatelske jmeno: jiri.grummich
- Heslo: PrvniPrihlaseni1

## Poznamka
Aplikace je zamerne bez externich zavislosti, aby fungovala i bez stahovani balicku z npm.
