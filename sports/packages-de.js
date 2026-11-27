// Foxino Sports: German questions (2026-11-27, the user: "put this vocabulary into sport option of content ... deutsch ... when selected
// there's no English"). Meine Freunde, Lektion 10 "Urlaub in Österreich" (pages 130–141): activities, Austria + Vienna, Präteritum of
// sein / haben, Perfekt with haben / sein, time words (im / am / vor, letzte Woche …). Same format as packages.js
// ("text [right|wrong|wrong] text", the first option is the right one), level 'DE', so the English package lists never show them.
// The lobby's DEUTSCH option opens every sport with ?pk=<these ids> (shared/content.js keeps only them). While German is on, the
// question prompts and the answer feedback are shown in German too (FUGIO_DE.on; a small text swap below, no English left at the question).
(function () {
  const P = (id, kind, n, title, subtitle, rounds) => ({ id, level: 'DE', lang: 'de', kind, n, title, subtitle, count: rounds.flat().length, rounds });
  const DE = [
    P('DE-L10-V1', 'Vocabulary', 1, 'Sommer und Winter in Österreich', 'baden, wandern, Ski fahren, rodeln …', [[
      'Im Sommer ist es heiß. Wir springen in den See und [baden|rodeln|lesen|bauen].',
      'Im Winter liegt viel Schnee. Wir fahren [Ski|Rad|Eis|Buch].',
      'Wir bauen im Garten einen [Schneemann|Strand|Sommer|Fluss].',
      'Es ist sehr heiß. Ich esse ein [Eis|Buch|Zelt|Ski].',
      'Am 24. Dezember feiern wir [Weihnachten|Sommer|Ostern|Juli].',
      'Zu Weihnachten bekomme ich viele [Geschenke|Schneemänner|Berge|Flüsse].',
      'Wir schlafen im Zelt. Wir [zelten|rodeln|jobben|bekommen] am See.',
      'In den Bergen gehen wir lange zu Fuß. Wir [wandern|baden|schlafen|lesen].',
      'Auf dem Eis kann man Schlittschuh [laufen|essen|lesen|baden].',
      'Mit dem Schlitten fahren wir den Berg hinunter. Wir [rodeln|baden|zelten|lesen].',
      'Ich besuche Oma und Opa. Ich besuche die [Großeltern|Geschwister|Lehrer|Kinder].',
      'Im Urlaub stehe ich spät auf. Ich [schlafe|wandere|jobbe|rodle] viel.',
    ], [
      'Ich lese gern. Im Urlaub [lese|esse|fahre|schlafe] ich drei Bücher.',
      'Wir spielen am Strand [Beachvolleyball|Eishockey|Langlauf|Schlittschuh].',
      'Auf dem Eis spielen die Jungen [Eishockey|Beachvolleyball|Tennis|Langlauf].',
      'Im Sommer arbeite ich im Café. Ich [jobbe|rodle|zelte|bade] in den Ferien.',
      'Mit dem Fahrrad fahren wir um den See. Wir fahren [Rad|Ski|Schlittschuh|Schnee].',
      'Wir sehen uns Wien an. Wir [besichtigen|vergessen|bekommen|rodeln] die Stadt.',
      'In den Ferien denke ich nicht an Mathe. Ich [vergesse|besuche|besichtige|bekomme] die Schule.',
      'Langlauf, Ski und Rodeln sind [Winteraktivitäten|Sommeraktivitäten|Hauptstädte|Flüsse].',
      'Baden, Zelten und Wandern sind [Sommeraktivitäten|Winteraktivitäten|Bundesländer|Berge].',
      'Wir fahren mit dem Zug nach Salzburg. Wir [reisen|rodeln|baden|bauen] gern.',
      'Im Winter fahre ich Ski, und mein Bruder fährt [Snowboard|Eis|Volleyball|Zelt].',
      'Im Restaurant esse ich ein [Schnitzel|Snowboard|Zelt|Ski].',
    ], [
      'Ich war am See und habe viel [gebadet|gerodelt|gebaut|geschrieben].',
      'Anna mag den Winter nicht. Es ist ihr zu [kalt|warm|heiß|grün].',
      'Julian ist in Innsbruck Snowboard [gefahren|gegessen|geschlafen|gelesen].',
      'Im Café Innsbruck gibt es Desserts und [Eis|Ski|Zelte|Schnee].',
      'Auf dem Campingplatz am See schlafen wir im Zelt. Wir [zelten|rodeln|bauen|fahren].',
      'Auf der Rodelbahn kann man auch im Sommer [rodeln|baden|zelten|lesen].',
      'Mit dem Skipass kann man in neun Skigebieten [Ski|Eis|Schnee|Zelt] fahren.',
      'Ich fahre nicht gern Ski. Aber ich [laufe|fahre|spiele|esse] gern Schlittschuh.',
      'Im Winter machen wir [Langlauf|Beachvolleyball|Zelten|Baden].',
      'Weihnachten ist im [Winter|Sommer|Juli|August].',
      'Im Juli ziehen wir gute Schuhe an und gehen in den Bergen [wandern|rodeln|lesen|schlafen].',
      'Wir wohnen bei Oma. Wir besuchen die [Großeltern|Bundesländer|Berge|Flüsse].',
    ]]),
    P('DE-L10-V2', 'Vocabulary', 2, 'Österreich und Wien', 'Hauptstadt, Donau, Prater, Stephansdom …', [[
      'Die Hauptstadt von Österreich ist [Wien|Graz|Salzburg|Linz].',
      'In Österreich bezahlt man mit [Euro|Kronen|Dollar|Pfund].',
      'Die Flagge von Österreich ist [rot-weiß-rot|schwarz-rot-gold|blau-weiß-rot|weiß-blau-rot].',
      'Österreich liegt in [Mitteleuropa|Südamerika|Afrika|Asien].',
      'Der höchste Berg in Österreich ist der [Großglockner|Prater|Stephansdom|Gasometer].',
      'Der längste Fluss in Österreich ist die [Donau|Elbe|Moldau|Themse].',
      'Der größte See in Österreich ist der [Neusiedler See|Stephansdom|Prater|Großglockner].',
      'Österreich hat neun [Bundesländer|Hauptstädte|Flüsse|Seen].',
      'In Österreich spricht man [Deutsch|Englisch|Spanisch|Tschechisch].',
      'Die Telefonvorwahl von Österreich ist [+43|+420|+49|+44].',
      'Die Internetadressen in Österreich enden auf [.at|.de|.cz|.it].',
      'Innsbruck liegt in [Tirol|Wien|Kärnten|Burgenland].',
    ], [
      'Österreich grenzt im Norden an Deutschland und [Tschechien|Italien|Slowenien|Ungarn].',
      'Im Süden grenzt Österreich an Italien und [Slowenien|Tschechien|Deutschland|Polen].',
      'Das Riesenrad steht im [Prater|Stephansdom|Rathaus|Gasometer].',
      'Der [Stephansdom|Prater|Gasometer|Rathaus] ist eine große Kirche in Wien.',
      'Im Schloss [Schönbrunn|Neuschwanstein|Bodensee|Prater] hat die Kaiserin gewohnt.',
      'Das bunte Haus mit vielen Farben heißt [Hundertwasserhaus|Rathaus|Gasometer|Stephansdom].',
      'In der [Albertina|Hofburg|Donau|Großglockner] gibt es Bilder von Picasso.',
      'Im Café Sacher in Wien isst man die [Sachertorte|Pizza|Suppe|Sushi].',
      'Im Winter kann man vor dem Wiener [Rathaus|Gasometer|Belvedere|Stephansdom] Schlittschuh laufen.',
      'Mozarts Geburtshaus steht in [Salzburg|Graz|Linz|Bregenz].',
      'Das Kunsthaus steht in [Graz|Linz|Bregenz|Wien].',
      'In Österreich leben etwa 8,8 Millionen [Einwohner|Berge|Seen|Flüsse].',
    ], [
      '1964 und 1976 waren in Innsbruck die Olympischen [Winterspiele|Sommerspiele|Weihnachten|Ferien].',
      'Das Autokennzeichen von Österreich ist [A|D|CZ|I].',
      'Wien, Graz und Linz sind [Städte|Flüsse|Berge|Seen].',
      'Tirol, Kärnten und Salzburg sind [Bundesländer|Seen|Flüsse|Berge].',
      'Die Hofburg und Schönbrunn sind [Schlösser|Seen|Berge|Flüsse].',
      'Klagenfurt ist die Hauptstadt von [Kärnten|Tirol|Wien|Salzburg].',
      'Bregenz liegt am [Bodensee|Neusiedler See|Gardasee|Balaton].',
      'Die Donau fließt durch [Wien|Innsbruck|Klagenfurt|Graz].',
      'Eisenstadt ist die Hauptstadt vom [Burgenland|Tirol|Vorarlberg|Kärnten].',
      'Der Großglockner ist ein [Berg|See|Fluss|Schloss].',
      'Der Neusiedler See liegt im [Burgenland|Tirol|Kärnten|Vorarlberg].',
      'Die Amtssprache in Österreich ist [Deutsch|Österreichisch|Tschechisch|Englisch].',
    ]]),
    P('DE-L10-G1', 'Grammar', 1, 'Präteritum – sein und haben', 'war, warst … hatte, hattest …', [[
      'Ich [war|warst|waren|wart] gestern in Wien.',
      'Wo [warst|war|waren|wart] du gestern?',
      'Anna [war|warst|wart|waren] in Innsbruck.',
      'Wir [waren|wart|war|warst] im Sommer in Graz.',
      'Ihr [wart|waren|warst|war] zweimal in Innsbruck.',
      'Anna und Julian [waren|war|wart|warst] in Österreich.',
      'Ich [hatte|hattest|hatten|hattet] keine Zeit.',
      'Du [hattest|hatte|hattet|hatten] Hunger.',
      'Julian [hatte|hattest|hatten|hattet] keine Zeit.',
      'Wir [hatten|hattet|hatte|hattest] ein prima Appartement.',
      'Ihr [hattet|hatten|hattest|hatte] im Urlaub viel Spaß.',
      'Die Kinder [hatten|hattet|hatte|hattest] Probleme mit der Orientierung.',
    ], [
      'Gestern [war|hatte|hattest|waren] ich in der Schule.',
      'Julian [war|warst|wart|waren] im Urlaub oft hungrig.',
      'Wo [wart|waren|warst|war] ihr gestern?',
      '[Hattest|Hatte|Hattet|Hatten] du in den Ferien Spaß?',
      'Vor drei Tagen [war|waren|warst|wart] Sven im Kunsthaus Graz.',
      'Letztes Jahr [waren|war|wart|warst] wir in Italien.',
      'Im Juli [war|hatte|waren|hatten] es ein bisschen langweilig.',
      'Unser Schlafzimmer [war|waren|hatte|wart] neben der Küche.',
      'Anna [hatte|hattet|hatten|hattest] schon vor zehn Jahren Probleme mit der Orientierung.',
      '[Warst|War|Wart|Waren] du nervös?',
      'Wir [hatten|hattet|hattest|hatte] in Wien viel Spaß.',
      'Mozarts Geburtshaus [war|waren|wart|warst] leider geschlossen.',
    ], [
      'Ich [hatte|war|waren|hattest] gestern Hunger.',
      'Ich [war|hatte|hattest|warst] gestern müde.',
      'Wir [waren|hatten|hattet|war] vor zwei Monaten in Linz.',
      'Wir [hatten|waren|wart|hattet] keine Zeit.',
      'Die Pause [hatten|waren|war|hattet] wir um 10 Uhr.',
      'Ihr [hattet|wart|hattest|hatten] Ferien in Österreich.',
      'Wo [wart|hattet|hattest|waren] ihr im Sommer?',
      'Max [hatte|war|hattet|hatten] gestern Geburtstag.',
      'Es [war|hatte|waren|wart] sehr kalt.',
      'Was [hattest|warst|hatte|hattet] du gestern in Mathe?',
      'Die Videos [waren|hatten|war|wart] lustig.',
      'Gestern [hatte|war|hattet|hatten] ich keine Hausaufgaben.',
    ]]),
    P('DE-L10-G2', 'Grammar', 2, 'Perfekt – haben oder sein', 'ich bin gefahren, ich habe gelernt …', [[
      'Ich [bin|habe|hat|ist] nach Innsbruck gefahren.',
      'Ich [habe|bin|ist|hat] Mathe gelernt.',
      'Wir [sind|haben|hat|seid] mit dem Zug gefahren.',
      'Wir [haben|sind|ist|seid] im Restaurant gegessen.',
      'Julian [ist|hat|bin|habe] zu Hause geblieben.',
      'Anna [hat|ist|habe|bin] ein Buch gelesen.',
      'Ich [bin|habe|hat|ist] um 8 Uhr aufgewacht.',
      'Anna und Julian [sind|haben|hat|ist] nach Wien geflogen.',
      '[Hast|Bist|Hat|Ist] du die Hofburg gesehen?',
      '[Seid|Habt|Sind|Haben] ihr schon aus Innsbruck zurückgekommen?',
      'Wir [haben|sind|seid|ist] viele Fotos gemacht.',
      'Er [ist|hat|bin|habe] in den Bergen gewandert.',
    ], [
      'Die Eltern haben einen Computer [gekauft|gekaufen|kaufte|kaufen].',
      'Was ist [passiert|gepassiert|passierte|passieren]?',
      'Wir haben die Stadt [besichtigt|gebesichtigt|besichtigen|besichtigte].',
      'Ich habe meine Oma [besucht|gebesucht|besuchen|besuchte].',
      'Wir haben lange am Bahnhof [gewartet|gewartt|warten|gewarten].',
      'Hast du das Gulasch [probiert|geprobiert|probieren|probierte]?',
      'Ich habe dich am Bahnhof [abgeholt|geabholt|abholen|abgeholen].',
      'Wir haben den Film [angeschaut|geangeschaut|anschauen|angeschauen].',
      'Mein Vater hat als Taxifahrer [gearbeitet|gearbeiten|arbeitete|arbeiten].',
      'Ich habe meinen Schlüssel [gesucht|gesuchen|suchte|suchen].',
      'Wir haben beim Museumsquartier [gewohnt|gewohnen|wohnten|wohnen].',
      'Habt ihr am Wochenende einen Ausflug [gemacht|gemachen|machte|machen]?',
    ], [
      'Sie sind nach Innsbruck [gefahren|gefahrt|fahren|gefuhren].',
      'Ich habe viele Videos [gesehen|gesiehen|gesehet|sehen].',
      'Wir haben einen schwierigen Test [geschrieben|geschreibt|schreiben|geschreiben].',
      'Ich habe mit meiner Mutter [gesprochen|gesprecht|gesprechen|sprechen].',
      'Er ist gerade nach Hause [gekommen|gekommt|kommen|gekamen].',
      'Der Film hat mir sehr [gefallen|gefallt|gefällt|gefiel].',
      'Wir haben im Hotel gut [geschlafen|geschlaft|schliefen|geschlief].',
      'Julian hat die Tickets [vergessen|gevergessen|vergesst|vergaß].',
      'Ich bin zu Hause [geblieben|gebleibt|geblieb|bleiben].',
      'Wir sind nach Wien [geflogen|gefliegt|geflugen|fliegen].',
      'Anna hat ein Buch [gelesen|gelest|gelesst|lesen].',
      'Wir sind in Linz spazieren [gegangen|gegeht|gegingen|gehen].',
    ]]),
    P('DE-L10-G3', 'Grammar', 3, 'Wann? – im, am, vor', 'im Sommer, am Montag, vor zwei Tagen, letzte Woche …', [[
      'Wir waren [im|am|vor|um] Sommer in Innsbruck.',
      '[Am|Im|Vor|Um] Montag hatten wir Mathe.',
      'Ich habe [im|am|vor|um] März Geburtstag.',
      'Wir haben [am|im|vor|um] Freitag einen Test geschrieben.',
      'Weihnachten ist [im|am|vor|um] Dezember.',
      'Das Konzert war [am|im|vor|um] 13. August.',
      'Ich war [vor|im|am|um] zwei Tagen in Graz.',
      '[Im|Am|Vor|Um] Winter fahren wir Ski.',
    ], [
      'Anna war [vor|im|am|um] drei Tagen in Innsbruck.',
      '[Am|Im|Vor|Um] Sonntag sind wir nach Berlin gefahren.',
      'Wir waren [am|im|vor|um] Wochenende im Kino.',
      'Ich bin [im|am|vor|um] Mai 2018 nach Innsbruck gefahren.',
      '[Am|Im|Vor|Um] 3. April haben wir einen Test geschrieben.',
      'Wir waren [vor|im|am|um] einem Monat in Salzburg.',
      'Der Schnee kommt [im|am|vor|um] Winter.',
      '[Im|Am|Vor|Um] April waren wir in Wien.',
    ], [
      '[Gestern|Morgen|Übermorgen|Nächste Woche] war ich in der Schule.',
      '[Vorgestern|Morgen|Übermorgen|Nächstes Jahr] hatte Benno Schnitzel.',
      '[Letzte|Letzten|Letztes|Letzter] Woche waren wir in Linz.',
      '[Letzten|Letzte|Letztes|Letzter] Monat waren wir in Italien.',
      '[Letztes|Letzte|Letzten|Letzter] Jahr waren wir in Wien.',
      '[Letzten|Letzte|Letztes|Letzter] Sommer war es in Innsbruck viel besser.',
      'Wir waren [vor|im|am|um] zehn Jahren in Graz.',
      '[Letztes|Letzte|Letzten|Letzter] Mal war es super.',
    ]]),
  ];
  window.GUMMY_PACKAGES = (window.GUMMY_PACKAGES || []).concat(DE);
  window.FUGIO_DE = { ids: DE.map((p) => p.id), title: 'Deutsch · Lektion 10', on: false };

  // ---- German on screen: when the chosen content is only these packages, the English prompts and feedback around a question are
  // swapped for German as they appear (every sport writes its own; one table here covers them all)
  const SUB = [
    ['TAP THE RIGHT WORD WHEN THE BAR IS GREEN!', 'TIPPE AUF DAS RICHTIGE WORT, WENN DER BALKEN GRÜN IST!'], ['Tap the right word when the bar is green', 'Tippe auf das richtige Wort, wenn der Balken grün ist'],
    ['STRONG TAKE-OFF!', 'STARKER ABSPRUNG!'], ['GAME YOU!', 'SPIEL FÜR DICH!'], ["YOU'RE IN GOAL", 'DU BIST IM TOR'], ['wait for the green', 'warte auf Grün'], ['no extra', 'kein Bonus'],
    ['Calling the players…', 'Die Spieler kommen…'], ['Getting the stadium ready…', 'Das Stadion wird vorbereitet…'], ['Grooming the snow…', 'Der Schnee wird präpariert…'],
    ['Building the course…', 'Die Strecke wird gebaut…'], ['Filling the lake…', 'Der See wird gefüllt…'], ['Painting the dragons…', 'Die Drachen werden bemalt…'], ['Painting the lines…', 'Die Linien werden gemalt…'],
    ['Waxing the board…', 'Das Brett wird gewachst…'], ['Waxing the long skis…', 'Die langen Ski werden gewachst…'], ['Waxing the skis…', 'Die Ski werden gewachst…'], ['Waxing the paddles…', 'Die Paddel werden gewachst…'],
    ['Foxino is warming up…', 'Foxino wärmt sich auf…'], ['Ready!', 'Bereit!'], ['SKI JUMP', 'SKISPRINGEN'], ['PADDLING', 'PADDELN'],
    ['TAP THE RIGHT WORD', 'TIPPE AUF DAS RICHTIGE WORT'], ['Tap the right word', 'Tippe auf das richtige Wort'],
    ['The right word is', 'Richtig ist'], ['the right word is', 'richtig ist'], ['The right word:', 'Richtig ist:'],
    ['tap the right word', 'tippe auf das richtige Wort'], ['answer on your phones!', 'antwortet auf euren Handys!'], ['answer on your phone!', 'antworte auf deinem Handy!'],
    ['Great shot!', 'Toller Schlag!'], ['Brilliant!', 'Klasse!'], ['Well done!', 'Gut gemacht!'], ['Not that one!', 'Nicht das!'],
    ['Too slow!', 'Zu langsam!'], ['TOO SLOW!', 'ZU LANGSAM!'], ['TOO FAST!', 'ZU SCHNELL!'], ['TOO LATE!', 'ZU SPÄT!'], ['IN RHYTHM!', 'IM RHYTHMUS!'],
    ['NO GOOD!', 'NICHT GUT!'], ['Great!', 'Toll!'], ['Yes!', 'Ja!'], ['PERFECT!', 'PERFEKT!'], ['GREAT!', 'SUPER!'], ['GOOD!', 'GUT!'], ['OOPS!', 'HOPPLA!'],
    ['WOBBLE!', 'WACKLIG!'], ['TAKE-OFF!', 'ABSPRUNG!'], ['YOUR SHOT', 'DEIN SCHLAG'], ["'S SHOT", ' SCHLÄGT'], ['in a row', 'in Folge'],
    ['SUDDEN DEATH!', 'ENTSCHEIDUNG!'], ['SAVED!', 'GEHALTEN!'], ['GOAL!', 'TOR!'], ['GOAL…', 'TOR…'], ['ROB MISSED!', 'ROB TRIFFT NICHT!'], ['POWER SHOT!', 'KRAFTSCHUSS!'],
    ['BLOCKED!', 'GEBLOCKT!'], ['BLOCK IT!', 'BLOCKEN!'], ['FAULT!', 'FEHLER!'], ['HIT!', 'TREFFER!'], ['OUT OF TIME!', 'ZEIT VORBEI!'], ['OVER THE K LINE!', 'ÜBER DIE K-LINIE!'],
    ['GIVES YOU SPEED!', 'GIBT DIR TEMPO!'], ['WIPEOUT!', 'STURZ!'], ['FINISH!', 'ZIEL!'], ['GET READY', 'MACH DICH BEREIT'], ['A DRAW!', 'UNENTSCHIEDEN!'],
    ['YOU WIN!', 'DU GEWINNST!'], ['You win!', 'Du gewinnst!'], ['You won!', 'Du hast gewonnen!'], ['You beat Rob!', 'Du hast Rob besiegt!'], ['Rob won this time!', 'Diesmal hat Rob gewonnen!'],
    ['Gold medal!', 'Goldmedaille!'], ['Silver medal!', 'Silbermedaille!'], ['Bronze medal!', 'Bronzemedaille!'], ['Keep practising!', 'Übe weiter!'], ['No missed gates!', 'Kein Tor verpasst!'],
    ['Your best:', 'Dein Rekord:'], ['Waiting for your friend…', 'Warte auf deinen Freund…'], ['PLAY AGAIN', 'NOCH EINMAL'],
  ];
  const RX0 = [   /* (whole Penalties prompts, before the short phrases below) */
    [/You are in goal! Rob shoots at the right word: tap it to dive there!/g, 'Du bist im Tor! Rob schießt auf das richtige Wort: Tippe darauf und spring dorthin!'],
    [/You are in goal! (.+?) shoots: tap the right word to dive there!/g, 'Du bist im Tor! $1 schießt: Tippe auf das richtige Wort und spring dorthin!'],
    [/You shoot! (.+?) is in goal: tap the right word!/g, 'Du schießt! $1 ist im Tor: Tippe auf das richtige Wort!'],
    [/Your turn to shoot: tap the bubble with the right word!/g, 'Du schießt: Tippe auf die Blase mit dem richtigen Wort!'],
  ];
  const RX1 = [   /* (the lobby's result cards between the sports) */
    [/^(.+) wins!$/g, '$1 gewinnt!'], [/Waiting for (.+?) to finish…/g, 'Warte, bis $1 fertig ist…'], [/NEXT comes when (.+?) has finished…/g, 'WEITER geht es, wenn $1 fertig ist…'],
    [/^Waiting for (.+?)…$/g, 'Warte auf $1…'], [/(\d+) of (\d+) right/g, '$1 von $2 richtig'], [/^(\d+) points$/g, '$1 Punkte'], [/(\d+) \/ (\d+) points/g, '$1 / $2 Punkte'],
    [/ on penalties/g, ' im Elfmeterschießen'], [/ on right answers/g, ' nach richtigen Antworten'], [/ on faster answers/g, ' nach schnelleren Antworten'],
    [/\bNEXT: /g, 'WEITER: '], [/\bPENALTIES\b/g, 'ELFMETER'], [/\bSHOOTOUT\b/g, 'ELFMETERSCHIESSEN'], [/\bSKI JUMP\b/g, 'SKISPRINGEN'], [/\bPADDLING\b/g, 'PADDELN'],
    [/^(.+) (won|lost)$/g, (m, a, w) => `${a} ${w === 'won' ? 'gewonnen' : 'verloren'}`],
  ];
  const RX = [
    [/(\d+) of (\d+) answers right/g, '$1 von $2 Antworten richtig'],
    [/\b(GATE|FORK|STROKE|SNOWBALL) (\d+) OF (\d+)/g, (m, w, a, b) => `${({ GATE: 'TOR', FORK: 'GABELUNG', STROKE: 'SCHLAG', SNOWBALL: 'SCHNEEBALL' })[w]} ${a} VON ${b}`],
    [/\b(JUMP|AIR) (\d+) OF (\d+)/g, 'SPRUNG $2 VON $3'], [/\b(JUMP|AIR) (\d+)\b/g, 'SPRUNG $2'], [/(\d+) QUESTIONS\b/g, '$1 FRAGEN'], [/\+(\d+) FAST\b/g, '+$1 SCHNELL'],
    [/(\d+) RIGHT!/g, '$1 RICHTIG!'], [/(\d+)(?:ST|ND|RD|TH) PLACE\b/g, '$1. PLATZ'], [/\bGAME ([A-Z]+)\b/g, 'SPIEL $1'], [/\bgames (\d)/g, 'Spiele $1'],
    [/\bQUESTION (\d+)/g, 'FRAGE $1'], [/\bRAMP\b/g, 'SCHANZE'], [/\bKICK (\d+)/g, 'SCHUSS $1'], [/\b(FOX|ROB|[A-Z]{2,12}) SHOOTS\b/g, '$1 SCHIESST'], [/\b(FOX|ROB|[A-Z]{2,12}) SAVES\b/g, '$1 HÄLT'],
  ];
  const EXACT = { 'Not': 'Nicht', 'FAST': 'SCHNELL', 'IN RHYTHM': 'IM RHYTHMUS', 'LATE': 'SPÄT', 'YOU': 'DU', 'GO!': 'LOS!', 'SCORE!': 'KORB!', 'POINTS': 'PUNKTE', 'GAMES': 'SPIELE', 'LEAVE': 'ZURÜCK', 'NEXT': 'WEITER', 'FINISH': 'ZIEL', 'JUDGES': 'RICHTER', "It's a draw!": 'Unentschieden!', 'Rob won this time': 'Diesmal hat Rob gewonnen', 'BACK TO THE STADIUM': 'ZURÜCK INS STADION',
    'seconds': 'Sekunden', 'metres': 'Meter', 'points': 'Punkte', 'games': 'Spiele', 'baskets': 'Körbe', 'WON': 'GEWONNEN', 'lost': 'verloren', 'Penalties': 'Elfmeter', 'Ski Jump': 'Skispringen', 'Paddling': 'Paddeln' };
  const MEMO = new Map();
  function tr(s) {
    if (MEMO.has(s)) return MEMO.get(s);
    let t = s;
    for (const [re, f] of RX0) t = t.replace(re, f);
    for (const [a, b] of SUB) if (t.includes(a)) t = t.split(a).join(b);
    for (const [re, f] of RX) t = t.replace(re, f);
    for (const [re, f] of RX1) t = t.replace(re, f);
    const k = t.trim(); if (EXACT[k]) t = t.replace(k, EXACT[k]);
    if (MEMO.size < 4000) MEMO.set(s, t);
    return t;
  }
  const fix = (n) => { const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return; const t = tr(v); if (t !== v) n.nodeValue = t; };
  function walk(root) {
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.nodeName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) fix(n);
  }
  const isDE = () => { if (window.FUGIO_DE.on) return true; const c = window.FUGIO_CONTENT, ids = (c && c.ids) || []; return ids.length > 0 && ids.every((id) => /^DE-/.test(id)); };
  /* (signs and cards drawn on a canvas, from the first frame: the 3D question signs write "Tap the right word" themselves, the courses paint
     their banners while the modules load; measureText too, so the layout fits the German. English content: untouched) */
  const C2 = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2) for (const fn of ['fillText', 'strokeText', 'measureText']) { const f = C2[fn]; C2[fn] = function (t, ...a) { return f.call(this, typeof t === 'string' && /[A-Za-z]/.test(t) && isDE() ? tr(t) : t, ...a); }; }
  window.FUGIO_DE.tr = tr; window.FUGIO_DE.walk = walk;
  function start() {
    if (!isDE()) return;
    window.FUGIO_DE.on = true; document.documentElement.lang = 'de';
    walk(document.body);
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(walk); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
