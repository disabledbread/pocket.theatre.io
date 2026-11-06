# Naptár-feliratkozások a musorlista.json-ból a három székhelyi színpad minden kombinációjára egy-egy .ics
# (pl. nagyszinhaz-padlas.ics), hogy mindenki csak a neki kellő színpadokra iratkozzon fel; a táj nem kerül bele.
# Csak a végleges hónapok kerülnek bele: az előzetes műsor még változhat, az a végleges lista megjelenésekor jön magától.
# Futtatás: python -I musor/naptar.py musorlista.json naptar
# A kimenet csak akkor változik, ha a műsor változik (a DTSTAMP a lista frissítési ideje),
# így a napi futás nem commitol fölöslegesen. Az esemény azonosítója a nap, a színpad és a cím alapján
# stabil, ezért egy időpont-módosítás a naptárban frissítésként jelenik meg, nem új eseményként.
import hashlib, json, sys
from itertools import combinations
from datetime import datetime, timedelta
from pathlib import Path

FAJLOK = {'Nagyszínház': 'nagyszinhaz', 'Kisfaludy terem': 'kisfaludy', 'Padlásszínház': 'padlas'}
HOSSZ = timedelta(hours=3)  # a befejezés nincs a PDF-ben
IDOZONA = '''BEGIN:VTIMEZONE
TZID:Europe/Budapest
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE'''.split('\n')


def szoveg(s):
    return str(s or '').replace('\\', '\\\\').replace('\n', '\\n').replace(',', '\\,').replace(';', '\\;')


def hajtogat(sor):
    # Az iCalendar legfeljebb 75 bájtos sorokat enged; a folytatósor szóközzel kezdődik
    b = sor.encode('utf-8')
    if len(b) <= 75:
        return [sor]
    sorok, akt = [], ''
    for ch in sor:
        hatar = 75 if not sorok else 74
        if len((akt + ch).encode('utf-8')) > hatar:
            sorok.append(akt if not sorok else ' ' + akt)
            akt = ''
        akt += ch
    sorok.append(akt if not sorok else ' ' + akt)
    return sorok


def esemenyek(adat, szinpad):
    stamp = adat['frissitve'].replace('-', '').replace(':', '')
    hely = None if szinpad == 'Székhelyen kívül' else f'Győri Nemzeti Színház, {szinpad}'
    szamlalo = {}
    for t in adat['szinpadok'].get(szinpad, []):
        honap = adat['honapok'].get(t['datum'][:7], {})
        if honap.get('allapot') != 'vegleges':
            continue
        kulcs = (t['datum'], t['cim'])
        szamlalo[kulcs] = szamlalo.get(kulcs, 0) + 1
        uid = hashlib.sha1(f"{t['datum']}|{szinpad}|{t['cim']}|{szamlalo[kulcs]}".encode()).hexdigest()[:20]
        leiras = [t.get('alcim'), t.get('megjegyzes') if szinpad != 'Székhelyen kívül' else None,
                  'módosítva' if t.get('modositott') else None]
        nap = t['datum'].replace('-', '')
        if t.get('kezdes'):
            kezd = datetime.fromisoformat(f"{t['datum']}T{t['kezdes']}")
            ido = [f'DTSTART;TZID=Europe/Budapest:{kezd:%Y%m%dT%H%M%S}',
                   f'DTEND;TZID=Europe/Budapest:{kezd + HOSSZ:%Y%m%dT%H%M%S}']
        else:
            ido = [f'DTSTART;VALUE=DATE:{nap}',
                   f"DTEND;VALUE=DATE:{datetime.fromisoformat(t['datum']) + timedelta(days=1):%Y%m%d}"]
        yield ['BEGIN:VEVENT', f'UID:{uid}@pocket-theatre', f'DTSTAMP:{stamp}', *ido,
               f"SUMMARY:{szoveg(t.get('cim') or 'Előadás')}",
               f"LOCATION:{szoveg(hely or t.get('megjegyzes') or 'Tájelőadás')}",
               f"DESCRIPTION:{szoveg(' · '.join(x for x in leiras if x))}", 'END:VEVENT']


def naptar(adat, nev, szinpadok):
    sorok = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pocket Theatre//Musor//HU', 'CALSCALE:GREGORIAN',
             'METHOD:PUBLISH', f'X-WR-CALNAME:{szoveg(nev)}', 'X-WR-TIMEZONE:Europe/Budapest',
             'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H', *IDOZONA]
    for sz in szinpadok:
        for e in esemenyek(adat, sz):
            sorok += e
    sorok.append('END:VCALENDAR')
    return '\r\n'.join(s for sor in sorok for s in hajtogat(sor)) + '\r\n'


def main():
    adat = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    ki = Path(sys.argv[2])
    ki.mkdir(exist_ok=True)
    for regi in ki.glob('*.ics'):
        regi.unlink()
    for n in range(1, len(FAJLOK) + 1):
        for valasztas in combinations(FAJLOK, n):
            nev = 'Pocket Theatre – ' + ' · '.join(valasztas)
            fajl = '-'.join(FAJLOK[sz] for sz in valasztas)
            (ki / f'{fajl}.ics').write_bytes(naptar(adat, nev, list(valasztas)).encode('utf-8'))
    print('Naptárak:', ', '.join(sorted(p.name for p in ki.glob('*.ics'))))


if __name__ == '__main__':
    main()
