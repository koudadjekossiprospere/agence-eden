/* Agence Eden — interactions. Sans dépendance obligatoire : GSAP/Lenis enrichissent si présents. */
(() => {
  const d = document;
  const root = d.documentElement;
  // Textes produits par le script : français, ou anglais sur les pages /en/ (<html lang="en-CA">)
  const t = (fr, en) => (root.lang.startsWith('en') ? en : fr);
  // Choix de langue du visiteur (FR | EN), mémorisé pour ses prochaines visites
  d.querySelectorAll('[data-langue]').forEach((a) => a.addEventListener('click', () => { try { localStorage.setItem('langue', a.dataset.langue); } catch (e) { /* stockage indisponible */ } }));
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bureau = matchMedia('(min-width: 900px)');
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  if (reduit) root.classList.add('reduit');
  if (gsap && ST) gsap.registerPlugin(ST);

  /* ---------- Défilement fluide ---------- */
  let lenis = null;
  if (!reduit && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    if (gsap && ST) {
      lenis.on('scroll', ST.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const boucle = (t) => { lenis.raf(t); requestAnimationFrame(boucle); };
      requestAnimationFrame(boucle);
    }
  }
  const hauteurEntete = () => parseFloat(getComputedStyle(root).getPropertyValue('--entete-h')) || 76;
  const allerA = (cible) => {
    if (lenis) lenis.scrollTo(cible, { offset: typeof cible === 'number' ? 0 : -hauteurEntete() + 1, duration: 1.5 });
    else if (typeof cible === 'number') scrollTo({ top: cible, behavior: reduit ? 'auto' : 'smooth' });
    else cible.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
  };
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const cible = d.getElementById(a.getAttribute('href').slice(1));
    if (!cible) return;
    e.preventDefault();
    fermerSommaire();
    allerA(cible);
    if (cible.tabIndex < 0 && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) cible.setAttribute('tabindex', '-1');
    cible.focus({ preventScroll: true });
  });

  /* ---------- En-tête : plein, caché en descendant, réapparaît en remontant ---------- */
  const entete = d.querySelector('[data-entete]');
  const barre = d.querySelector('[data-barre-mobile]');
  const achat = d.querySelector('[data-achat]');
  let dernierY = 0;
  let piedVisible = false;
  let achatMasque = true;
  const surDefilement = () => {
    const y = lenis ? lenis.scroll : scrollY;
    const descend = y > dernierY + 2 && y > 280;
    const monte = y < dernierY - 2;
    entete.classList.toggle('est-plein', y > 30);
    if (!root.classList.contains('menu-ouvert') && !d.querySelector('.nav__groupe.est-ouvert')) {
      if (descend) entete.classList.add('est-cache');
      if (monte || y < 280) entete.classList.remove('est-cache');
    }
    dernierY = y;
    const fin = Math.max(1, d.documentElement.scrollHeight - innerHeight);
    barre?.style.setProperty('--progres', Math.min(1, y / fin).toFixed(3));
    barre?.classList.toggle('est-visible', y > innerHeight * 0.55 && !piedVisible);
    achat?.classList.toggle('est-visible', !achatMasque && !piedVisible);
  };
  if (lenis) lenis.on('scroll', surDefilement);
  else addEventListener('scroll', surDefilement, { passive: true });
  surDefilement();

  const pied = d.querySelector('.pied');
  if (pied) new IntersectionObserver(([e]) => { piedVisible = e.isIntersecting; surDefilement(); }).observe(pied);

  /* ---------- Sous-menu Mariages ---------- */
  const groupe = d.querySelector('[data-groupe]');
  if (groupe) {
    const bouton = groupe.querySelector('button');
    const ouvrir = (oui) => { groupe.classList.toggle('est-ouvert', oui); bouton.setAttribute('aria-expanded', oui); };
    bouton.addEventListener('click', () => ouvrir(!groupe.classList.contains('est-ouvert')));
    if (matchMedia('(hover: hover)').matches) {
      let minuteur;
      groupe.addEventListener('pointerenter', () => { clearTimeout(minuteur); ouvrir(true); });
      groupe.addEventListener('pointerleave', () => { minuteur = setTimeout(() => ouvrir(false), 180); });
    }
    d.addEventListener('click', (e) => { if (!groupe.contains(e.target)) ouvrir(false); });
    groupe.addEventListener('keydown', (e) => { if (e.key === 'Escape') { ouvrir(false); bouton.focus(); } });
    groupe.addEventListener('focusout', (e) => { if (!groupe.contains(e.relatedTarget)) ouvrir(false); });
  }

  /* ---------- Menu plein écran ---------- */
  const burger = d.querySelector('[data-burger]');
  const menu = d.querySelector('[data-menu]');
  const page = d.body.className;
  const fermerMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true; menu.classList.remove('est-visible');
    burger.setAttribute('aria-expanded', 'false');
    root.classList.remove('menu-ouvert'); lenis?.start();
    d.body.style.overflow = '';
  };
  burger?.addEventListener('click', () => {
    if (!menu.hidden) { fermerMenu(); return; }
    menu.hidden = false;
    menu.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', i));
    requestAnimationFrame(() => menu.classList.add('est-visible'));
    burger.setAttribute('aria-expanded', 'true');
    root.classList.add('menu-ouvert'); lenis?.stop();
    d.body.style.overflow = 'hidden';
    menu.querySelector('a')?.focus();
  });
  menu?.querySelectorAll('a').forEach((a) => {
    if (location.pathname.endsWith('/' + a.getAttribute('href')) || (a.getAttribute('href') === 'index.html' && page.includes('accueil'))) a.setAttribute('aria-current', 'page');
  });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fermerMenu(); fermerSommaire(); } });

  /* ---------- Découpe des titres en mots ---------- */
  const decouper = (el) => {
    let n = 0;
    const parcourir = (noeud) => {
      [...noeud.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const frag = d.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach((morceau) => {
            if (!morceau) return;
            if (/^\s+$/.test(morceau)) { frag.append(' '); return; }
            const mot = d.createElement('span');
            mot.className = 'mot';
            mot.style.setProperty('--m', n++);
            const interieur = d.createElement('span');
            interieur.textContent = morceau;
            mot.append(interieur);
            frag.append(mot);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') parcourir(c);
      });
    };
    parcourir(el);
    return el.querySelectorAll('.mot');
  };
  d.querySelectorAll('[data-lignes]').forEach((el) => { el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); decouper(el).forEach((m) => m.setAttribute('aria-hidden', 'true')); });

  /* ---------- Apparitions au défilement ---------- */
  d.querySelectorAll('[data-cascade]').forEach((parent) => {
    parent.querySelectorAll(':scope > [data-apparait], :scope > * > [data-apparait]').forEach((el, i) => el.style.setProperty('--i', i));
  });
  d.querySelectorAll('.coches li, .pile li').forEach((li, i, tous) => {
    const rang = [...li.parentElement.children].indexOf(li);
    li.style.setProperty('--i', rang);
    if (li.parentElement.classList.contains('pile')) li.style.setProperty('--r', `${((rang * 37) % 9) - 4}deg`);
  });
  const vu = new IntersectionObserver((entrees) => {
    entrees.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('est-vu'); vu.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  d.querySelectorAll('[data-apparait], [data-devoile], [data-lignes], [data-trace], .pile, .coches, .etapes').forEach((el) => vu.observe(el));

  /* ---------- Énoncé qui s'encre ---------- */
  d.querySelectorAll('.enonce').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const mots = [...decouper(el)];
    mots.forEach((m) => m.setAttribute('aria-hidden', 'true'));
    if (gsap && ST && !reduit) {
      ST.create({
        trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: true,
        onUpdate: (s) => { const k = Math.round(s.progress * mots.length); mots.forEach((m, i) => m.classList.toggle('est-encre', i < k)); },
      });
    } else mots.forEach((m) => m.classList.add('est-encre'));
  });

  /* ---------- Chapitres : rail (bureau) + sommaire (mobile) ---------- */
  const chapitres = [...d.querySelectorAll('[data-chapitre]')];
  const sommaireBouton = d.querySelector('[data-sommaire-bouton]');
  const sommaire = d.querySelector('[data-sommaire]');
  function fermerSommaire() {
    if (!sommaire || sommaire.hidden) return;
    sommaire.hidden = true;
    sommaireBouton.setAttribute('aria-expanded', 'false');
  }
  if (chapitres.length) {
    const rail = d.createElement('nav');
    rail.className = 'rail';
    rail.setAttribute('aria-label', t('Chapitres de la page', 'Page chapters'));
    const ol = d.createElement('ol');
    const liste = d.querySelector('[data-sommaire-liste]');
    chapitres.forEach((ch, i) => {
      if (!ch.id) ch.id = 'chapitre-' + (i + 1);
      const num = String(i + 1).padStart(2, '0');
      const nom = ch.dataset.chapitre;
      ol.insertAdjacentHTML('beforeend', `<li><a href="#${ch.id}"><span class="rail__trait"></span><span class="rail__nom">${num} — ${nom}</span></a></li>`);
      liste?.insertAdjacentHTML('beforeend', `<li><a href="#${ch.id}"><span>${num}</span>${nom}</a></li>`);
    });
    rail.append(ol);
    d.body.append(rail);
    const numEl = d.querySelector('[data-chapitre-num]');
    const nomEl = d.querySelector('[data-chapitre-nom]');
    const activer = (ch) => {
      const i = chapitres.indexOf(ch);
      d.querySelectorAll('.rail a, [data-sommaire-liste] a').forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + ch.id));
      if (numEl) numEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(chapitres.length).padStart(2, '0')}`;
      if (nomEl) nomEl.textContent = ch.dataset.chapitre;
      rail.classList.toggle('est-visible', i > 0 || (lenis ? lenis.scroll : scrollY) > 200);
    };
    activer(chapitres[0]);
    const observateurChapitres = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => { if (e.isIntersecting) activer(e.target); });
    }, { rootMargin: '-48% 0px -48% 0px' });
    chapitres.forEach((ch) => observateurChapitres.observe(ch));
    sommaireBouton?.addEventListener('click', () => {
      const ouvrir = sommaire.hidden;
      sommaire.hidden = !ouvrir;
      sommaireBouton.setAttribute('aria-expanded', ouvrir);
      if (ouvrir) sommaire.querySelector('[aria-current="true"]')?.focus();
    });
    d.addEventListener('click', (e) => { if (sommaire && !sommaire.hidden && !sommaire.contains(e.target) && !sommaireBouton.contains(e.target)) fermerSommaire(); });
    d.querySelector('[data-haut]')?.addEventListener('click', () => { fermerSommaire(); allerA(0); });
  } else if (sommaireBouton) sommaireBouton.hidden = true;

  /* ---------- Vidéos : lecture seulement à l'écran ---------- */
  const videos = d.querySelectorAll('video[data-boucle]');
  const vObs = new IntersectionObserver((entrees) => {
    entrees.forEach((e) => { if (e.isIntersecting && !reduit) e.target.play().catch(() => {}); else e.target.pause(); });
  }, { threshold: 0.1 });
  videos.forEach((v) => { v.muted = true; if (reduit) v.removeAttribute('autoplay'); vObs.observe(v); });
  // Le film (Mariages) : le clic lance le film en vrai plein écran (tout le moniteur) ; « Fermer », Échap (sortie du plein écran),
  // la fin du film ou quitter la section en défilant l'arrêtent et le remettent au début. Plein écran refusé : lecture sur place.
  d.querySelectorAll('[data-film]').forEach((bloc) => {
    const lecteur = bloc.querySelector('.film__lecteur');
    const v = lecteur.querySelector('video');
    const jouer = bloc.querySelector('.film__jouer');
    const fermer = lecteur.querySelector('.film__fermer');
    const halo = lecteur.querySelector('.film__ambiance');
    const ctx = halo.getContext('2d');
    let boucle = 0;
    const peindre = () => { // halo : la vidéo, réduite à 48 px puis floutée, remplit les côtés de l'écran
      if (v.readyState >= 2) ctx.drawImage(v, 0, 0, halo.width, halo.height);
      boucle = requestAnimationFrame(peindre);
    };
    const pleinEcran = () => d.fullscreenElement || d.webkitFullscreenElement;
    const arreter = () => {
      if (lecteur.hidden) return;
      if (pleinEcran()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      v.pause();
      v.currentTime = 0;
      cancelAnimationFrame(boucle);
      lecteur.hidden = true;
      bloc.classList.remove('est-en-lecture');
    };
    jouer.addEventListener('click', () => {
      lecteur.hidden = false;
      bloc.classList.add('est-en-lecture');
      v.muted = false;
      v.play().catch(() => {}); // d'abord la lecture, dans le geste de l'utilisateur (Safari)
      if (lecteur.requestFullscreen) lecteur.requestFullscreen().catch(() => {});
      else if (lecteur.webkitRequestFullscreen) lecteur.webkitRequestFullscreen();
      else v.webkitEnterFullscreen?.(); // iPhone : le lecteur plein écran du système
      peindre();
      fermer.focus({ preventScroll: true });
    });
    const sortiePleinEcran = () => { if (!pleinEcran()) arreter(); };
    // En plein écran, faire défiler (molette, glisser du doigt vers le haut ou le bas) ferme le film : la page reprend là où elle était
    lecteur.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > 4) arreter(); }, { passive: true });
    let y0 = null;
    lecteur.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    lecteur.addEventListener('touchmove', (e) => { if (y0 !== null && Math.abs(e.touches[0].clientY - y0) > 60) { y0 = null; arreter(); } }, { passive: true });
    d.addEventListener('fullscreenchange', sortiePleinEcran);
    d.addEventListener('webkitfullscreenchange', sortiePleinEcran);
    v.addEventListener('webkitendfullscreen', arreter);
    fermer.addEventListener('click', () => { arreter(); jouer.focus({ preventScroll: true }); });
    bloc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lecteur.hidden) { arreter(); jouer.focus({ preventScroll: true }); } });
    v.addEventListener('ended', arreter);
    new IntersectionObserver(([e]) => { if (e.intersectionRatio < 0.5 && !pleinEcran()) arreter(); }, { threshold: [0, 0.5] }).observe(bloc);
  });

  /* ---------- Accueil : diaporama de l'arche — défile seul ; pause, flèches, clavier et glisser du doigt ---------- */
  d.querySelectorAll('[data-diaporama]').forEach((bloc) => {
    const images = [...bloc.querySelectorAll('.diaporama__image')];
    const num = bloc.querySelector('[data-diaporama-num]');
    const pause = bloc.querySelector('[data-pause]');
    const DUREE = 5500;
    bloc.style.setProperty('--duree', `${DUREE}ms`);
    let i = 0;
    let minuterie = 0;
    let enPause = reduit; // mouvement réduit : rien ne défile tout seul
    let visible = true;
    const montrer = (n) => {
      i = (n + images.length) % images.length;
      images.forEach((im, j) => { im.classList.toggle('est-actif', j === i); im.setAttribute('aria-hidden', j !== i); });
      num.textContent = String(i + 1).padStart(2, '0');
      bloc.classList.remove('est-en-cours');
      void bloc.offsetWidth; // relance la barre de progression
      bloc.classList.toggle('est-en-cours', !enPause);
      clearTimeout(minuterie);
      if (!enPause) minuterie = setTimeout(function suivante() { if (visible) montrer(i + 1); else minuterie = setTimeout(suivante, DUREE); }, DUREE);
    };
    const basculer = (p) => {
      enPause = p;
      bloc.classList.toggle('est-en-pause', p);
      pause.setAttribute('aria-label', p ? t('Reprendre le défilement', 'Resume the slideshow') : t('Mettre le défilement en pause', 'Pause the slideshow'));
      bloc.setAttribute('aria-live', p ? 'polite' : 'off'); // annoncé seulement quand le visiteur fait défiler lui-même
      montrer(i);
    };
    bloc.querySelector('[data-prec]').addEventListener('click', () => montrer(i - 1));
    bloc.querySelector('[data-suiv]').addEventListener('click', () => montrer(i + 1));
    pause.addEventListener('click', () => basculer(!enPause));
    bloc.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') montrer(i - 1); if (e.key === 'ArrowRight') montrer(i + 1); });
    let x0 = null;
    bloc.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && !e.target.closest('button')) x0 = e.clientX; });
    bloc.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) montrer(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    bloc.addEventListener('pointercancel', () => { x0 = null; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(bloc);
    basculer(enPause);
  });

  /* ---------- Listes à élément actif (image collante, méthode) ---------- */
  const actifAuCentre = (items, cibles) => {
    const obs = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = items.indexOf(e.target);
        items.forEach((it, j) => it.classList.toggle('est-actif', j === i));
        cibles.forEach((c, j) => c.classList.toggle('est-actif', j === i));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    items.forEach((it) => obs.observe(it));
  };
  d.querySelectorAll('[data-engagements]').forEach((bloc) => actifAuCentre([...bloc.querySelectorAll('.engagement')], [...bloc.querySelectorAll('.engagements__visuel .media')]));

  /* ---------- Volets « Pourquoi Eden » ---------- */
  d.querySelectorAll('[data-volets]').forEach((bloc) => {
    const volets = [...bloc.querySelectorAll('.volet')];
    const num = bloc.querySelector('[data-volet-num]');
    bloc.activerVolet = (i) => {
      volets.forEach((v, j) => v.classList.toggle('est-actif', j === i));
      if (num) num.textContent = String(i + 1).padStart(2, '0');
    };
    // Quand le défilement pilote les volets (.volets--pilote, bureau avec GSAP), c'est lui qui choisit le volet actif
    const libre = () => !bloc.querySelector('.volets--pilote');
    volets.forEach((v, i) => {
      v.addEventListener('pointerenter', () => { if (bureau.matches && libre()) bloc.activerVolet(i); });
      v.addEventListener('focus', () => { if (libre()) bloc.activerVolet(i); });
      v.addEventListener('click', () => { if (libre()) bloc.activerVolet(i); });
    });
  });

  /* ---------- Sous-navigation (Gourmet) ---------- */
  d.querySelectorAll('.sous-nav').forEach((nav) => {
    const liens = [...nav.querySelectorAll('a')];
    const obs = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (!e.isIntersecting) return;
        liens.forEach((a) => {
          const actif = a.getAttribute('href') === '#' + e.target.id;
          a.setAttribute('aria-current', actif);
          if (actif) a.scrollIntoView({ block: 'nearest', inline: 'center' });
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    liens.forEach((a) => { const s = d.querySelector(a.getAttribute('href')); if (s) obs.observe(s); });
  });

  /* ---------- Sélecteur de formule (onglets accessibles) ---------- */
  d.querySelectorAll('[data-onglets]').forEach((bloc) => {
    const onglets = [...bloc.querySelectorAll('[role="tab"]')];
    const choisir = (o, focus) => {
      onglets.forEach((x) => {
        const oui = x === o;
        x.setAttribute('aria-selected', oui);
        x.tabIndex = oui ? 0 : -1;
        d.getElementById(x.getAttribute('aria-controls')).hidden = !oui;
      });
      if (focus) o.focus();
    };
    onglets.forEach((o, i) => {
      o.addEventListener('click', () => choisir(o));
      o.addEventListener('keydown', (e) => {
        const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); choisir(onglets[(i + k + onglets.length) % onglets.length], true); }
        if (e.key === 'Home') { e.preventDefault(); choisir(onglets[0], true); }
        if (e.key === 'End') { e.preventDefault(); choisir(onglets.at(-1), true); }
      });
    });
  });

  /* ---------- Témoignages ---------- */
  d.querySelectorAll('[data-temoins]').forEach((bloc) => {
    const citations = [...bloc.querySelectorAll('.temoin')];
    const photos = [...bloc.querySelectorAll('.temoins__photos .media')];
    const compte = bloc.querySelector('.temoins__compte');
    let i = 0;
    const montrer = (n) => {
      i = (n + citations.length) % citations.length;
      citations.forEach((c, j) => { c.classList.toggle('est-actif', j === i); c.setAttribute('aria-hidden', j !== i); });
      photos.forEach((p, j) => p.classList.toggle('est-actif', j === i));
      compte.textContent = `${String(i + 1).padStart(2, '0')} / ${String(citations.length).padStart(2, '0')}`;
    };
    bloc.querySelector('[data-precedent]').addEventListener('click', () => montrer(i - 1));
    bloc.querySelector('[data-suivant]').addEventListener('click', () => montrer(i + 1));
    bloc.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') montrer(i - 1); if (e.key === 'ArrowRight') montrer(i + 1); });
    montrer(0);
  });

  /* ---------- FAQ : ouverture douce ---------- */
  d.querySelectorAll('.faq details').forEach((det) => {
    const rep = det.querySelector('.faq__reponse');
    if (det.open) det.classList.add('est-ouvert');
    det.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault();
      if (!det.open) { det.open = true; requestAnimationFrame(() => requestAnimationFrame(() => det.classList.add('est-ouvert'))); }
      else {
        det.classList.remove('est-ouvert');
        const fin = () => { if (!det.classList.contains('est-ouvert')) det.open = false; };
        if (reduit) fin(); else rep.addEventListener('transitionend', fin, { once: true });
      }
    });
  });

  /* ---------- Barre d'achat (Le Plan Eden) ---------- */
  if (achat) {
    const zones = [...d.querySelectorAll('[data-masque-achat]')];
    const etat = new Map();
    const obs = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => etat.set(e.target, e.isIntersecting));
      achatMasque = [...etat.values()].some(Boolean);
      surDefilement();
    });
    zones.forEach((z) => { etat.set(z, true); obs.observe(z); });
  }

  /* ---------- Formulaire de contact en étapes ---------- */
  d.querySelectorAll('[data-formulaire]').forEach((form) => {
    const etapes = [...form.querySelectorAll('.etape-form')];
    const repere = [...d.querySelectorAll('[data-repere-etape]')];
    const merci = d.querySelector('[data-merci]');
    let courante = 0;
    const type = new URLSearchParams(location.search).get('type');
    if (type) { const r = form.querySelector(`input[name="type"][data-cle="${CSS.escape(type)}"]`); if (r) r.checked = true; }
    const erreur = (champ, message) => {
      const bloc = champ.closest('.champ') || champ.closest('fieldset');
      bloc.classList.toggle('a-erreur', !!message);
      let msg = bloc.querySelector('.champ__erreur');
      if (!msg && message) {
        msg = d.createElement('p');
        msg.className = 'champ__erreur';
        msg.id = (champ.id || champ.name) + '-erreur';
        bloc.append(msg);
      }
      if (msg) msg.textContent = message || '';
      if (message) champ.setAttribute('aria-describedby', msg.id); else champ.removeAttribute('aria-describedby');
      champ.setAttribute('aria-invalid', !!message);
    };
    const valider = (etape) => {
      let premier = null;
      etape.querySelectorAll('[required]').forEach((c) => {
        let message = '';
        if (c.type === 'radio') {
          if (!etape.querySelector(`input[name="${c.name}"]:checked`)) message = t('Choisissez une option.', 'Please choose an option.');
        } else if (!c.value.trim()) message = t('Ce champ est requis.', 'This field is required.');
        else if (c.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.value)) message = t('Vérifiez l’adresse courriel (ex. : nom@domaine.com).', 'Please check the email address (e.g. name@domain.com).');
        else if (c.type === 'tel' && c.value.replace(/\D/g, '').length < 7) message = t('Ajoutez un numéro joignable, indicatif compris.', 'Please add a number where we can reach you, including the area code.');
        if (c.type !== 'radio' || c === etape.querySelector(`input[name="${c.name}"]`)) erreur(c, message);
        if (message && !premier) premier = c;
      });
      premier?.focus();
      return !premier;
    };
    const aller = (n) => {
      courante = n;
      etapes.forEach((e, i) => { e.hidden = i !== n; });
      repere.forEach((r, i) => { r.toggleAttribute('aria-current', i === n); if (i === n) r.setAttribute('aria-current', 'step'); r.classList.toggle('est-fait', i < n); });
      allerA(form.closest('section'));
      etapes[n].querySelector('legend')?.focus();
    };
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-suivant-etape]') && valider(etapes[courante])) aller(courante + 1);
      if (e.target.closest('[data-precedent-etape]')) aller(courante - 1);
    });
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') erreur(e.target, ''); });
    form.addEventListener('change', (e) => { if (e.target.type === 'radio') erreur(form.querySelector(`input[name="${e.target.name}"]`), ''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!valider(etapes[courante])) return;
      const donnees = new FormData(form);
      const lignes = [];
      form.querySelectorAll('[data-libelle]').forEach((c) => {
        const v = c.type === 'radio' ? donnees.get(c.name) : c.value;
        if (v && !lignes.some((l) => l.startsWith(c.dataset.libelle))) lignes.push(t(`${c.dataset.libelle} : ${v}`, `${c.dataset.libelle}: ${v}`));
      });
      const sujet = `${t('Demande', 'Inquiry')} — ${donnees.get('type') || t('événement', 'event')} — ${donnees.get('prenom') || ''} ${donnees.get('nom') || ''}`.trim();
      // Site statique : la demande part par courriel. À la mise en ligne, brancher un service de formulaire ici.
      location.href = `mailto:info@agenceeden.com?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(lignes.join('\n'))}`;
      form.hidden = true;
      d.querySelector('.formulaire__etapes')?.setAttribute('hidden', '');
      merci.hidden = false;
      merci.querySelector('h2').focus();
    });
  });

  /* ---------- Chiffres qui se comptent (le nombre final reste dans le HTML) ---------- */
  const compteur = new IntersectionObserver((entrees) => entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    compteur.unobserve(e.target);
    const el = e.target;
    const fin = Number(el.textContent);
    const debut = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - debut) / 1600);
      el.textContent = Math.round(fin * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }), { threshold: 0.6 });
  if (!reduit) d.querySelectorAll('[data-compte]').forEach((el) => compteur.observe(el));

  /* ---------- Portfolio : six photos à l'écran, catalogue plein écran (filtres), visionneuse en pleine définition ---------- */
  d.querySelectorAll('[data-portfolio]').forEach((bloc) => {
    const cat = bloc.querySelector('[data-catalogue]');
    const dlg = bloc.querySelector('[data-visionneuse]');
    const ouvrir = bloc.querySelector('[data-ouvrir-catalogue]');
    const items = [...cat.querySelectorAll('.galerie__item')];
    const zoneFiltres = cat.querySelector('[data-filtres]');
    const TOUT = t('Tout', 'All');
    let filtre = TOUT;
    const choisis = () => items.filter((it) => filtre === TOUT || it.dataset.categorie === filtre);
    const afficher = () => {
      const liste = choisis();
      items.forEach((it) => { it.hidden = !liste.includes(it); it.classList.remove('est-nouveau'); });
      void cat.offsetWidth; // relance la cascade d'apparition
      liste.forEach((it, i) => { it.style.setProperty('--i', i); it.classList.add('est-nouveau'); });
    };
    // Un filtre par catégorie présente : une catégorie sans photo n'apparaît pas
    [TOUT, ...new Set(items.map((it) => it.dataset.categorie))].forEach((c) => {
      const b = d.createElement('button');
      b.type = 'button';
      b.className = 'portfolio__filtre';
      b.setAttribute('aria-pressed', c === TOUT);
      const sup = d.createElement('sup');
      sup.textContent = c === TOUT ? items.length : items.filter((it) => it.dataset.categorie === c).length;
      b.append(c, sup);
      b.addEventListener('click', () => {
        filtre = c;
        zoneFiltres.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        afficher();
        cat.scrollTo({ top: 0 });
      });
      zoneFiltres.append(b);
    });

    // Catalogue : une entrée d'historique, pour que le retour du navigateur (ou du téléphone) le ferme au lieu de quitter la page
    const ouvrirCatalogue = (pousser) => {
      if (cat.open) return;
      cat.showModal();
      cat.scrollTop = 0;
      afficher();
      lenis?.stop();
      if (pousser) history.pushState({ catalogue: true }, '', '#catalogue');
    };
    ouvrir.addEventListener('click', () => ouvrirCatalogue(true));
    cat.querySelector('[data-retour]').addEventListener('click', () => cat.close());
    cat.addEventListener('close', () => {
      if (!dlg.open) lenis?.start();
      if (history.state?.catalogue) history.back();
      else if (location.hash === '#catalogue') history.replaceState(null, '', location.pathname + location.search);
      ouvrir.focus({ preventScroll: true });
    });
    addEventListener('popstate', () => { if (dlg.open) dlg.close(); if (cat.open) cat.close(); });
    if (location.hash === '#catalogue') ouvrirCatalogue(false);

    const vImg = dlg.querySelector('[data-visionneuse-img]');
    const vLegende = dlg.querySelector('[data-visionneuse-legende]');
    const vCompte = dlg.querySelector('[data-visionneuse-compte]');
    let liste = items;
    let courant = 0;
    let retour = null;
    const montrer = (i) => {
      courant = (i + liste.length) % liste.length;
      const img = liste[courant].querySelector('img');
      vImg.src = img.getAttribute('src').replace(/-\d+\.webp$/, '-hd-1080.webp'); // la photo entière, en pleine définition
      vImg.alt = img.alt;
      vLegende.textContent = img.alt;
      vCompte.textContent = `${String(courant + 1).padStart(2, '0')} / ${String(liste.length).padStart(2, '0')}`;
    };
    const voir = (lst, it, bouton) => { liste = lst; retour = bouton; montrer(lst.indexOf(it)); dlg.showModal(); lenis?.stop(); };
    items.forEach((it) => {
      const b = it.querySelector('button');
      b.setAttribute('aria-haspopup', 'dialog');
      b.addEventListener('click', () => voir(choisis(), it, b));
    });
    bloc.querySelectorAll('[data-photo]').forEach((b) => {
      b.setAttribute('aria-haspopup', 'dialog');
      b.addEventListener('click', () => voir(items, items[b.dataset.photo], b));
    });
    dlg.addEventListener('close', () => { if (!cat.open) lenis?.start(); retour?.focus({ preventScroll: true }); });
    dlg.querySelector('[data-fermer]').addEventListener('click', () => dlg.close());
    dlg.querySelector('[data-prec]').addEventListener('click', () => montrer(courant - 1));
    dlg.querySelector('[data-suiv]').addEventListener('click', () => montrer(courant + 1));
    dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') montrer(courant - 1); if (e.key === 'ArrowRight') montrer(courant + 1); });
    // Glisser (mobile) pour changer de photo ; un clic dans le vide ferme
    let x0 = null;
    let glisse = false;
    dlg.addEventListener('pointerdown', (e) => { x0 = e.clientX; glisse = false; });
    dlg.addEventListener('pointerup', (e) => {
      if (x0 !== null && Math.abs(e.clientX - x0) > 50) { glisse = true; montrer(courant + (e.clientX < x0 ? 1 : -1)); }
      x0 = null;
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg && !glisse) dlg.close(); });
  });

  /* ==========================================================================
     Séquences GSAP (bureau et mobile adaptés, désactivées en mouvement réduit)
     ========================================================================== */
  if (!gsap || !ST || reduit) return;
  const mm = gsap.matchMedia();

  // Le chaos se range : les mots éparpillés retrouvent leur place
  d.querySelectorAll('[data-chaos]').forEach((section) => {
    const scene = section.querySelector('.chaos__scene');
    const mots = [...section.querySelectorAll('.chaos__liste li')];
    const texte = section.querySelector('.chaos__texte');
    const graines = mots.map((_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 39.425)]);
    const ecart = (li, i) => {
      const s = scene.getBoundingClientRect();
      const r = li.getBoundingClientRect();
      const [gx, gy] = graines[i];
      return {
        x: s.left + 40 + gx * (s.width - 80 - r.width) - r.left,
        y: s.top + 90 + gy * (s.height - 180 - r.height) - r.top,
      };
    };
    const construire = (epingle) => {
      gsap.set(mots, { clearProps: 'transform,opacity' });
      const tl = gsap.timeline({
        scrollTrigger: epingle
          ? { trigger: scene, start: 'top top', end: '+=140%', scrub: 1, pin: true, invalidateOnRefresh: true }
          : { trigger: section, start: 'top 85%', end: 'center 55%', scrub: 1, invalidateOnRefresh: true },
      });
      tl.from(mots, {
        x: (i, li) => ecart(li, i).x,
        y: (i, li) => ecart(li, i).y,
        rotation: (i) => graines[i][2] * 16,
        scale: (i) => 0.82 + graines[i][0] * 0.5,
        opacity: (i) => 0.35 + graines[i][1] * 0.65,
        ease: 'power2.inOut', duration: 1, stagger: { each: 0.02, from: 'random' },
      }, 0);
      tl.from(texte, { opacity: 0.12, y: 30, ease: 'power1.out', duration: 0.5 }, 0.55);
      return tl;
    };
    mm.add('(min-width: 900px)', () => { construire(true); });
    mm.add('(max-width: 899px)', () => { construire(false); });
  });

  // Nos univers : le panneau recouvert recule doucement
  mm.add('(min-width: 900px)', () => {
    const panneaux = [...d.querySelectorAll('.panneau')];
    panneaux.slice(0, -1).forEach((p, i) => {
      gsap.to(p.querySelector('.panneau__fond') || p.querySelector('.panneau__grille'), {
        scale: 0.94, ease: 'none', transformOrigin: '50% 30%',
        scrollTrigger: { trigger: panneaux[i + 1], start: 'top 60%', end: 'top top', scrub: true },
      });
    });
  });

  // Pourquoi Eden : la section tient l'écran et les volets s'ouvrent en suivant le défilement (amorti).
  // Fluidité : les photos gardent une taille fixe ; seul un scale (carte graphique) reproduit le
  // cadrage « cover » à la largeur courante, donc aucune photo n'est redessinée pendant le mouvement.
  mm.add('(min-width: 900px)', () => {
    const nettoyages = [];
    d.querySelectorAll('[data-volets]').forEach((bloc) => {
      const liste = bloc.querySelector('.volets');
      const volets = [...bloc.querySelectorAll('.volet')];
      const imgs = volets.map((v) => v.querySelector('img'));
      const n = volets.length;
      const OUVERT = 4.4; // même ouverture que .volet.est-actif dans le CSS
      const etat = { pos: 0 };
      let largeurs = { dispo: 0, H: 0 };
      let courant = 0;
      const echelleCouverture = (img, w, h) => Math.max(w / img.getAttribute('width'), h / img.getAttribute('height'));
      const mesurer = () => {
        const gap = parseFloat(getComputedStyle(liste).columnGap) || 0;
        largeurs = { dispo: liste.clientWidth - gap * (n - 1), H: liste.clientHeight };
        const wMax = (largeurs.dispo * OUVERT) / (OUVERT + n - 1);
        imgs.forEach((img) => {
          img.__S = echelleCouverture(img, wMax, largeurs.H); // photo entière à l'échelle du volet ouvert
          img.style.width = `${img.getAttribute('width') * img.__S}px`;
          img.style.height = `${img.getAttribute('height') * img.__S}px`;
        });
      };
      let pilote = true;
      const rendre = () => {
        if (!pilote) return; // une animation encore en cours après le retour en mobile ne réécrit rien
        const ouv = volets.map((_, i) => Math.max(0, 1 - Math.abs(etat.pos - i)));
        const grows = ouv.map((o) => 1 + (OUVERT - 1) * o);
        const somme = grows.reduce((a, b) => a + b, 0);
        volets.forEach((v, i) => {
          v.style.flexGrow = grows[i];
          const w = (largeurs.dispo * grows[i]) / somme;
          const k = echelleCouverture(imgs[i], w, largeurs.H) / imgs[i].__S;
          imgs[i].style.transform = `translate(-50%, -50%) scale(${(k * (1 + 0.1 * (1 - ouv[i]))).toFixed(4)})`;
        });
        const i = Math.round(etat.pos);
        if (i !== courant) { courant = i; bloc.activerVolet(i); }
      };
      liste.classList.add('volets--pilote');
      mesurer();
      rendre();
      // Un seul canal amorti : le défilement et le survol visent une position, etat.pos la rejoint en douceur
      const versPos = gsap.quickTo(etat, 'pos', { duration: 0.7, ease: 'power3.out', onUpdate: rendre });
      const cible = { pos: 0 };
      // Courte pause au début et à la fin : le premier et le dernier volet restent ouverts un instant
      gsap.timeline({
        scrollTrigger: {
          trigger: bloc.querySelector('.volets__scene'), start: 'top top', end: `+=${(n - 1) * 60}%`,
          pin: true, scrub: true, invalidateOnRefresh: true, onRefresh: () => { mesurer(); rendre(); },
        },
      }).to({}, { duration: 0.12 }).to(cible, { pos: n - 1, duration: 1, ease: 'none', onUpdate: () => versPos(cible.pos) }).to({}, { duration: 0.12 });
      // Survol : ignoré pendant le défilement (les volets glissent sous un pointeur immobile) ; focus et clic toujours actifs
      let dernierDefilement = 0;
      const noterDefilement = () => { dernierDefilement = performance.now(); };
      if (lenis) lenis.on('scroll', noterDefilement); else addEventListener('scroll', noterDefilement, { passive: true });
      const ouvrir = volets.map((_, i) => () => versPos(i));
      const survol = volets.map((_, i) => () => { if (performance.now() - dernierDefilement > 450) versPos(i); });
      volets.forEach((v, i) => { v.addEventListener('pointerenter', survol[i]); v.addEventListener('focus', ouvrir[i]); v.addEventListener('click', ouvrir[i]); });
      nettoyages.push(() => {
        pilote = false;
        gsap.killTweensOf(etat);
        if (lenis) lenis.off('scroll', noterDefilement); else removeEventListener('scroll', noterDefilement);
        volets.forEach((v, i) => { v.removeEventListener('pointerenter', survol[i]); v.removeEventListener('focus', ouvrir[i]); v.removeEventListener('click', ouvrir[i]); v.style.flexGrow = ''; });
        imgs.forEach((img) => { img.style.width = ''; img.style.height = ''; img.style.transform = ''; });
        liste.classList.remove('volets--pilote');
      });
    });
    return () => nettoyages.forEach((f) => f());
  });

  // La méthode (Mariages) : l'écran se fige ; un mot à la fois, chacun le temps d'un écran de défilement, puis il laisse place au suivant
  mm.add('(min-width: 900px)', () => {
    const blocs = [...d.querySelectorAll('[data-methode]')];
    blocs.forEach((bloc) => {
      const etapes = [...bloc.querySelectorAll('.methode__etape')];
      const n = etapes.length;
      const progres = bloc.querySelector('.methode__progres');
      const compte = bloc.querySelector('.methode__compte');
      bloc.classList.add('methode--pilote');
      ST.create({
        trigger: bloc, pin: bloc.querySelector('.methode__scene'), start: 'top top', end: () => '+=' + innerHeight * n,
        refreshPriority: 1, invalidateOnRefresh: true, // mesurée avant les animations placées plus bas dans la page
        onUpdate: (s) => {
          const x = s.progress * n;
          const actif = Math.min(n - 1, Math.floor(x));
          etapes.forEach((e, i) => { e.classList.toggle('est-actif', i === actif); e.classList.toggle('est-passe', i < actif); });
          progres.style.setProperty('--p', s.progress.toFixed(3));
          compte.textContent = String(actif + 1).padStart(2, '0');
        },
      });
      // Variante photos (L'agence) : derrière la carte, chaque photo monte et recouvre la précédente juste avant son mot
      const fonds = [...bloc.querySelectorAll('.methode__fond')];
      if (fonds.length > 1) {
        const tl = gsap.timeline({ scrollTrigger: { trigger: bloc, start: 'top top', end: () => '+=' + innerHeight * n, scrub: true, invalidateOnRefresh: true } });
        fonds.forEach((f, i) => {
          const img = f.querySelector('img');
          if (i) tl.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 0.5 }, i - 0.5);
          tl.fromTo(img, { yPercent: i ? 5 : 0 }, { yPercent: -5, ease: 'none', duration: i ? 1.5 : 1 }, i ? i - 0.5 : 0);
        });
        tl.set({}, {}, n); // la frise dure n écrans, comme l'épinglage
      }
    });
    return () => blocs.forEach((bloc) => {
      bloc.classList.remove('methode--pilote');
      bloc.querySelectorAll('.methode__etape').forEach((e, i) => { e.classList.toggle('est-actif', i === 0); e.classList.remove('est-passe'); });
    });
  });

  // Film qui s'ouvre plein cadre
  mm.add('(min-width: 900px)', () => {
    d.querySelectorAll('.ecran-film').forEach((bloc) => {
      const cadre = bloc.querySelector('.ecran-film__cadre');
      gsap.fromTo(cadre, { '--inset-x': '14%', '--inset-y': '9%' }, {
        '--inset-x': '0%', '--inset-y': '0%', ease: 'none',
        scrollTrigger: { trigger: bloc, start: 'top top', end: 'bottom bottom', scrub: true },
      });
      gsap.from(bloc.querySelector('.ecran-film__legende'), { opacity: 0, y: 20, scrollTrigger: { trigger: bloc, start: '40% center', end: '60% center', scrub: true } });
    });
  });

  // Les 11 chapitres du Plan Eden défilent à l'horizontale
  mm.add('(min-width: 900px)', () => {
    d.querySelectorAll('.defile').forEach((bloc) => {
      const piste = bloc.querySelector('.defile__piste');
      const barreP = bloc.querySelector('.defile__progres');
      const distance = () => piste.scrollWidth - innerWidth;
      gsap.to(piste, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: bloc, start: 'top top', end: () => '+=' + distance(), scrub: 0.6, pin: true, invalidateOnRefresh: true,
          onUpdate: (s) => barreP?.style.setProperty('--p', s.progress.toFixed(3)),
        },
      });
    });
  });

  // Parallaxe douce sur les images marquées
  d.querySelectorAll('[data-parallaxe]').forEach((el) => {
    const v = parseFloat(el.dataset.parallaxe) || 8;
    gsap.fromTo(el, { yPercent: -v }, { yPercent: v, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Ouverture : le cadre vidéo descend légèrement pendant que le texte reste
  d.querySelectorAll('[data-ouverture]').forEach((o) => {
    mm.add('(min-width: 900px)', () => {
      gsap.to(o.querySelector('.ouverture__cadre'), { yPercent: 8, ease: 'none', scrollTrigger: { trigger: o, start: 'top top', end: 'bottom top', scrub: true } });
    });
  });

  // L'agence : la vidéo d'ouverture (en miroir, scaleX négatif) s'approche et descend pendant que le texte monte
  d.querySelectorAll('.agence-ouverture').forEach((o) => {
    const defile = { trigger: o, start: 'top top', end: 'bottom top', scrub: true };
    // rotation: 0 explicite : sinon GSAP lit le miroir CSS comme une rotation de 180° et la vidéo se retrouve à l'envers
    gsap.fromTo(o.querySelector('.agence-ouverture__fond video'), { scaleX: -1, scaleY: 1, rotation: 0, yPercent: 0 }, { scaleX: -1.08, scaleY: 1.08, rotation: 0, yPercent: 8, ease: 'none', scrollTrigger: defile });
    gsap.to(o.querySelector('.agence-ouverture__texte'), { yPercent: -12, ease: 'none', scrollTrigger: { ...defile } });
  });


  // Fenêtre qui s'ouvre : l'image ou la vidéo passe d'une fente étroite au cadre entier
  d.querySelectorAll('[data-fenetre]').forEach((f) => {
    gsap.timeline({ scrollTrigger: { trigger: f, start: 'top 88%', end: 'center 50%', scrub: true } })
      .fromTo(f, { clipPath: 'inset(12% 30% 12% 30%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' }, 0)
      .fromTo(f.querySelector('img, video'), { scale: 1.3 }, { scale: 1, ease: 'none' }, 0);
  });

  // Photos de fond des finales : léger recul pendant que la section arrive
  d.querySelectorAll('[data-recul]').forEach((img) => {
    gsap.fromTo(img, { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.closest('section'), start: 'top bottom', end: 'bottom bottom', scrub: true } });
  });

  addEventListener('load', () => ST.refresh());
})();
