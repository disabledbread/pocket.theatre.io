# Napi frissítés: a műsoroldal PDF-linkjeiből musorlista.json színpadonként
# Futtatás: python -I musor/frissit.py <kimeneti json> [helyi musor.html a hálózat helyett]
# A weboldalról csak a PDF-ek címe és a gombfeliratok kellenek (előzetes vagy végleges);
# az előadások kizárólag a PDF-ekből jönnek.
import html, json, re, sys, tempfile, urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pdf_feldolgoz import feldolgoz

OLDAL = 'https://gyoriszinhaz.hu/musor/'
UA = 'Pocket Theatre musorfrissito'


def letolt(url):
    keres = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(keres, timeout=60) as v:
        return v.read()


def pdf_linkek(oldal):
    linkek = []
    for url, felirat in re.findall(r'<a href="([^"]+\.pdf)"[^>]*>.*?</span><span>(.*?)</span></a>', oldal, re.S):
        felirat = html.unescape(re.sub(r'<[^>]+>', '', felirat)).strip()
        elozetes = 'előzetes' in felirat.lower() or 'elozetes' in url.lower()
        linkek.append({'url': url, 'felirat': felirat, 'elozetes': elozetes})
    return linkek


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    kimenet = Path(sys.argv[1])
    oldal = Path(sys.argv[2]).read_text(encoding='utf-8') if len(sys.argv) > 2 else letolt(OLDAL).decode('utf-8')
    linkek = pdf_linkek(oldal)
    if not linkek:
        sys.exit('Nem találtam PDF-linket a műsoroldalon, a régi fájl marad.')

    regi = json.loads(kimenet.read_text(encoding='utf-8')) if kimenet.exists() else {'honapok': {}, 'szinpadok': {}}
    honapok, tetelek_honaponkent = {}, {}
    with tempfile.TemporaryDirectory() as tmp:
        for link in linkek:
            pdf = Path(tmp) / Path(link['url']).name
            pdf.write_bytes(letolt(link['url']))
            e = feldolgoz(pdf)
            if not e['tetelek']:
                sys.exit(f"Egy előadást sem találtam ebben: {link['url']}, a régi fájl marad.")
            for t in e['tetelek']:
                ho = t['datum'][:7]
                # Egy PDF végén előre jelzett hónap (pl. a decemberiben a január) mindig előzetes,
                # és csak akkor használjuk, ha a saját PDF-je még nincs kint
                sajat = ho == e['honap']
                if not sajat and ho in honapok and honapok[ho]['sajat_pdf']:
                    continue
                if ho not in honapok or (sajat and not honapok[ho]['sajat_pdf']):
                    honapok[ho] = {'allapot': 'elozetes' if link['elozetes'] or not sajat else 'vegleges',
                                   'pdf': link['url'], 'felirat': link['felirat'], 'kiadva': e['kiadva'],
                                   'modositva': e['modositva'], 'sajat_pdf': sajat}
                    tetelek_honaponkent[ho] = []
                if honapok[ho]['pdf'] == link['url']:
                    tetelek_honaponkent[ho].append(t)

    # A weboldalról már levett hónapok közül csak az előző hónap marad meg a régi fájlból,
    # hogy a hónap elején még visszanézhető legyen, de a régiek ne halmozódjanak fel
    most = datetime.now(timezone.utc)
    hatar = f'{most.year - 1}-12' if most.month == 1 else f'{most.year}-{most.month - 1:02d}'
    for ho, adat in regi['honapok'].items():
        if ho not in honapok and ho >= hatar:
            honapok[ho] = adat
            tetelek_honaponkent[ho] = [{**t, 'szinpad': sz} for sz, l in regi['szinpadok'].items() for t in l if t['datum'].startswith(ho)]

    szinpadok = {}
    for ho in sorted(tetelek_honaponkent):
        for t in sorted(tetelek_honaponkent[ho], key=lambda t: (t['datum'], t['kezdes'] or '')):
            szinpadok.setdefault(t['szinpad'], []).append({k: v for k, v in t.items() if k != 'szinpad'})
    uj = {'forras': OLDAL, 'honapok': dict(sorted(honapok.items())), 'szinpadok': szinpadok}

    if {k: v for k, v in regi.items() if k != 'frissitve'} == uj:
        print('Nincs változás.')
        return
    for ho, adat in uj['honapok'].items():
        elotte = regi['honapok'].get(ho)
        if elotte is None:
            print(f"Új hónap: {ho} ({adat['allapot']})")
        elif elotte['allapot'] != adat['allapot'] or elotte['pdf'] != adat['pdf']:
            print(f"{ho}: {elotte['allapot']} -> {adat['allapot']}, {adat['pdf']}")
    print('Tételek színpadonként:', {sz: len(l) for sz, l in szinpadok.items()})
    kimenet.write_text(json.dumps({'frissitve': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), **uj},
                                  ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
