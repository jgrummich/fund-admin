# Projektovy system fondu

Webova aplikace pro evidenci fondu s backendem nad PostgreSQL.

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
- Prilohy se realne nahravaji pres backend (metadata i soubor)
- Lze smazat cely workflow run vcetne jeho tasku
- Data aplikace se ukladaji do PostgreSQL (bez localStorage)

## Technologie
- Frontend: HTML/CSS/vanilla JS
- Backend: Node.js + Express
- Databaze: PostgreSQL
- Upload souboru: local storage nebo S3 kompatibilni object storage (dle konfigurace)

## Spusteni
1. Zkopirujte konfiguraci:
	- Windows PowerShell: `Copy-Item .env.example .env`
2. Spustte PostgreSQL:
	- `docker compose up -d`
3. Nainstalujte zavislosti:
	- `npm install`
4. Spustte aplikaci:
	- `npm run dev`
5. Otevrete v prohlizeci:
	- `http://localhost:5500`

## Produkcni poznamka k uploadu
- `STORAGE_PROVIDER=local`: soubory se ukladaji do slozky `uploads/`.
- `STORAGE_PROVIDER=s3`: soubory se ukladaji do S3 (nebo S3 kompatibilniho hostingu).
- Pro hosting doplnte hodnoty `S3_*` v `.env`.

## Prihlaseni
- Uzivatelske jmeno: jiri.grummich
- Heslo: PrvniPrihlaseni1

## Poznamka
Po prvnim startu backend automaticky vytvori potrebne tabulky a inicialni data.
