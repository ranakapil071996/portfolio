#!/usr/bin/env python3
"""Generate multilingual AI-assistance clips in Kapil's spoken cadence.

English keeps the recorded kapilaudio.wav clips. Other locales use male
neural TTS, written like his interview walkthrough (short sentences,
tech names in English, impact first), then loudness-matched to his MP3s.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import tempfile
from datetime import date
from pathlib import Path

from edge_tts import Communicate

ROOT = Path(__file__).resolve().parents[1]
VOICE_DIR = ROOT / "assets" / "story-voice"
LOCALE_DIR = ROOT / "i18n" / "locales"
CAREER_START = date(2018, 9, 1)
YEAR_FROM = 8
YEAR_TO = 16
CACHE_BUST = "i18n1"

VOICES = {
    "de": ("de-DE-ConradNeural", "+4%"),
    "fr": ("fr-FR-HenriNeural", "+4%"),
    "es": ("es-ES-AlvaroNeural", "+4%"),
    "ja": ("ja-JP-KeitaNeural", "-4%"),
    "ar": ("ar-SA-HamedNeural", "+0%"),
    "hi": ("hi-IN-MadhurNeural", "+6%"),
}

COMPANIES = {
    "wolt": "Wolt",
    "bolt": "Bolt",
    "zalando": "Zalando",
    "delivery-hero": "Delivery Hero",
    "aviv": "Aviv",
    "flink": "Flink",
    "home24": "Home 24",
    "otto": "Otto",
    "xxxlutz": "XXX Lutz",
    "amazon": "Amazon",
    "langdock": "Langdock",
    "hometogo": "Home To Go",
    "trade-republic": "Trade Republic",
    "contentful": "Contentful",
    "revolut": "Revolut",
    "taxfix": "Taxfix",
    "wise": "Wise",
    "n8n": "n8n",
}

STEP_ORDER = [
    "welcome",
    "positioning",
    "impact",
    "airtel",
    "dotpe",
    "tyroo",
    "meddo",
    "lotto",
    "about",
    "exp-airtel",
    "exp-dotpe",
    "skills",
    "education",
    "close",
]

# Spoken scripts follow Kapil's English recording: first person, lists, tech names kept.
SCRIPTS = {
    "en": {
        "hello": "Hello {name}. This is assistance mode. Kapil will now walk you through the resume in his own voice.",
        "helloTitle": "Assistance mode",
        "titles": {
            "welcome": "Introduction",
            "positioning": "What I do",
            "impact": "Impact",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "How I work",
            "exp-airtel": "Airtel — full story",
            "exp-dotpe": "DotPe — full story",
            "skills": "Skills",
            "education": "Education",
            "close": "Next step",
        },
        "steps": {
            "welcome": "Hi, I'm Kapil Rana, I'm a Senior Manager and SDE III at Airtel Payments Bank. I walk you through this portfolio the way I would in an interview: impact first, then the technologies.",
            "positioning": "I have {years} years of full-stack experience in React, Next.js, TypeScript, Node.js and React Native. I led Internet Banking for about a million users a day and I manage a team of 4. I ship products across 5 companies mostly in fintech, commerce, advertising, marketing.",
            "impact": "I organize each role by business impact and technical impact. First, what changed for users and revenue, then the stack that made it possible. Let's start with Airtel, my current role.",
            "airtel": "At Airtel, I own the internet banking experience under RBI compliance. We improved page speed with Next.js server-side rendering, Cloudflare caching and Core Web Vitals. We reduced bot abuse with Cloudflare security and Google reCAPTCHA. I own a NestJS backend also on Node.js in front of that service. I run a Kong gateway for load balancing with plugins for CORS, JWT and rate limiting. On the content side, Next.js and Prismic sits on a Node.js Prismic service I built. In production, I use Kibana and Grafana for logging and monitoring.",
            "dotpe": "Before Airtel, I was a software engineer II at DotPe. From 2020 to 2025, I led 4 engineers on merchant billing, invoicing, inventory, GST and analytics. Food ordering reached 50,000 daily users and over a crore a day. I built the React Native waiter app and owned the Node.js backend behind it. APIs, order sync and offline-ready flows. We also shipped real-time chat with Socket.io and Firebase.",
            "tyroo": "At Tyroo, I built the video template UI in React, Redux and Ant Design. I also owned the video generation backend, a Node.js service and a Lottie service that rendered marketing videos at scale.",
            "meddo": "At Meddo Health, I built the React Native patient app, the doctor app plus the web product. Those covered video consults, chats, EMR and lab bookings. I also wrote Node.js APIs for Google Auth, bulk upload and media.",
            "lotto": "My first role was at Skill and Lotto. I built an online platform and back-office tools with JavaScript, jQuery, PHP and Bootstrap.",
            "about": "Day to day, I run the team in Jira, planning, priorities and delivery. I keep a high bar on React, TypeScript, quality. I own Node.js and NestJS services and I work with other engineers on API contracts and backend designing. After we ship, I stay in logs and dashboards using Kibana, Grafana and Kong.",
            "exp-airtel": "This is the full Airtel role. I lead four engineers, we ship Next.js with Prismic and NestJS backend and Kong for load balancing, JWT, CORS and rate limiting. Page speed comes from server-side rendering, Cloudflare caching and Web Vitals. I own this surface end-to-end, not just tickets.",
            "exp-dotpe": "DotPe is a multi-product chapter: billing, WhatsApp marketing, live chat, the React Native waiter app, the Node.js behind it. It was revenue-linked work, across web, mobile and backend.",
            "skills": "Skills are grouped into frontend, backend, mobile, DevOps and leadership. React and TypeScript and Node are the core. On the backend, I own NestJS and Node service for Prismic. The waiter app is built on React Native and the video generation tool is built on Node.js backend. On mobile, waiter app, patient app, doctor app is on React Native. Then Express, MongoDB, SQL, AWS, Docker, Kong, Kibana and Grafana.",
            "education": "I completed B.Tech in Computer Science engineering at K.R. Mangalam University from 2014 to 2018. Since then, I have worked at product companies in Gurgaon.",
            "close": "That's the walkthrough. If you would like to talk, email or LinkedIn is the easiest, or you can contact me on my number. You can also download the PDF, restart this anytime from the avatar. Thank you.",
        },
    },
    "de": {
        "hello": "Hallo {name}. Das ist der Assistenzmodus. Kapil führt Sie jetzt mit seiner Stimme durch den Lebenslauf.",
        "helloTitle": "Assistenzmodus",
        "titles": {
            "welcome": "Einführung",
            "positioning": "Was ich mache",
            "impact": "Wirkung",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "So arbeite ich",
            "exp-airtel": "Airtel — die ganze Story",
            "exp-dotpe": "DotPe — die ganze Story",
            "skills": "Skills",
            "education": "Ausbildung",
            "close": "Nächster Schritt",
        },
        "steps": {
            "welcome": "Hi, ich bin Kapil Rana, Senior Manager und SDE III bei Airtel Payments Bank. Ich führe Sie durch dieses Portfolio wie in einem Interview: zuerst die Wirkung, dann die Technik.",
            "positioning": "Ich habe {years} Jahre Full-Stack-Erfahrung in React, Next.js, TypeScript, Node.js und React Native. Ich habe Internet Banking für etwa eine Million Nutzer am Tag geleitet und führe ein Team von 4. Ich habe Produkte in 5 Unternehmen ausgeliefert, vor allem in Fintech, Commerce, Advertising, Marketing.",
            "impact": "Ich ordne jede Rolle nach Business-Impact und Tech-Impact. Zuerst, was sich für Nutzer und Umsatz geändert hat, dann der Stack, der das möglich gemacht hat. Wir starten mit Airtel, meiner aktuellen Rolle.",
            "airtel": "Bei Airtel verantworte ich das Internet-Banking unter RBI-Vorgaben. Wir haben die Seitengeschwindigkeit mit Next.js Server-Side Rendering, Cloudflare Caching und Core Web Vitals verbessert. Bot-Missbrauch haben wir mit Cloudflare Security und Google reCAPTCHA reduziert. Ich besitze auch ein NestJS Backend auf Node.js. Davor läuft ein Kong Gateway für Load Balancing, mit Plugins für CORS, JWT und Rate Limiting. Content läuft über Next.js und Prismic auf einem Node.js Prismic Service, den ich gebaut habe. In Produktion nutze ich Kibana und Grafana für Logs und Monitoring.",
            "dotpe": "Vor Airtel war ich Software Engineer II bei DotPe. Von 2020 bis 2025 habe ich 4 Engineers bei Merchant Billing geführt: Rechnungen, Inventar, GST und Analytics. Food Ordering kam auf 50.000 Nutzer am Tag und über eine Crore am Tag. Ich habe die React Native Waiter App gebaut und das Node.js Backend dahinter besessen. APIs, Order Sync, Offline-Flows. Dazu kam Echtzeit-Chat mit Socket.io und Firebase.",
            "tyroo": "Bei Tyroo habe ich das Video-Template UI in React, Redux und Ant Design gebaut. Ich habe auch das Video-Generation Backend besessen: ein Node.js Service und ein Lottie Service, der Marketing-Videos in Scale gerendert hat.",
            "meddo": "Bei Meddo Health habe ich die React Native Patienten-App, die Arzt-App und das Web-Produkt gebaut. Video-Consults, Chats, EMR, Laborbuchungen. Dazu Node.js APIs für Google Auth, Bulk Upload und Media.",
            "lotto": "Meine erste Rolle war bei Skill and Lotto. Ich habe eine Online-Plattform und Back-Office Tools mit JavaScript, jQuery, PHP und Bootstrap gebaut.",
            "about": "Im Alltag führe ich das Team in Jira: Planung, Prioritäten, Delivery. Ich halte die Latte hoch bei React, TypeScript, Qualität. Ich besitze Node.js und NestJS Services und arbeite mit anderen Engineers an API Contracts und Backend-Design. Nach dem Ship bleibe ich in Logs und Dashboards: Kibana, Grafana und Kong.",
            "exp-airtel": "Das ist die volle Airtel-Rolle. Ich führe vier Engineers, wir shippen Next.js mit Prismic und ein NestJS Backend und Kong für Load Balancing, JWT, CORS und Rate Limiting. Seitengeschwindigkeit kommt von Server-Side Rendering, Cloudflare Caching und Web Vitals. Ich besitze diese Fläche end-to-end, nicht nur Tickets.",
            "exp-dotpe": "DotPe ist ein Multi-Produkt-Kapitel: Billing, WhatsApp Marketing, Live Chat, die React Native Waiter App, das Node.js dahinter. Das war umsatznahes Arbeiten, über Web, Mobile und Backend.",
            "skills": "Skills sind gruppiert in Frontend, Backend, Mobile, DevOps und Leadership. React und TypeScript und Node sind der Kern. Im Backend besitze ich NestJS und den Node Service für Prismic. Die Waiter App ist React Native, das Video-Generation Tool läuft auf einem Node.js Backend. Mobile: Waiter App, Patienten-App, Arzt-App auf React Native. Dann Express, MongoDB, SQL, AWS, Docker, Kong, Kibana und Grafana.",
            "education": "Ich habe B.Tech in Computer Science Engineering an der K.R. Mangalam University von 2014 bis 2018 gemacht. Seitdem arbeite ich bei Produktunternehmen in Gurgaon.",
            "close": "Das war der Walkthrough. Wenn Sie sprechen möchten, sind E-Mail oder LinkedIn am einfachsten, oder Sie erreichen mich auf meiner Nummer. Sie können auch das PDF laden und das hier jederzeit über den Avatar neu starten. Danke.",
        },
    },
    "fr": {
        "hello": "Bonjour {name}. Voici le mode assistance. Kapil va maintenant vous présenter le CV avec sa voix.",
        "helloTitle": "Mode assistance",
        "titles": {
            "welcome": "Introduction",
            "positioning": "Ce que je fais",
            "impact": "Impact",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "Comment je travaille",
            "exp-airtel": "Airtel — l'histoire complète",
            "exp-dotpe": "DotPe — l'histoire complète",
            "skills": "Compétences",
            "education": "Formation",
            "close": "Et ensuite",
        },
        "steps": {
            "welcome": "Salut, je suis Kapil Rana, Senior Manager et SDE III chez Airtel Payments Bank. Je vous présente ce portfolio comme en entretien : d'abord l'impact, ensuite la tech.",
            "positioning": "J'ai {years} ans d'expérience full-stack en React, Next.js, TypeScript, Node.js et React Native. J'ai dirigé l'Internet Banking pour environ un million d'utilisateurs par jour et je manage une équipe de 4. J'ai livré des produits dans 5 entreprises, surtout fintech, commerce, publicité, marketing.",
            "impact": "J'organise chaque poste par impact business et impact technique. D'abord ce qui a changé pour les utilisateurs et le revenu, ensuite la stack qui l'a rendu possible. On commence par Airtel, mon poste actuel.",
            "airtel": "Chez Airtel, je possède l'expérience Internet Banking sous conformité RBI. On a amélioré la vitesse des pages avec Next.js server-side rendering, Cloudflare caching et Core Web Vitals. On a réduit l'abus bots avec Cloudflare security et Google reCAPTCHA. Je possède aussi un backend NestJS sur Node.js. Devant ce service, je fais tourner un Kong gateway pour le load balancing, avec des plugins CORS, JWT et rate limiting. Côté contenu, Next.js et Prismic s'appuient sur un service Node.js Prismic que j'ai construit. En production, j'utilise Kibana et Grafana pour les logs et le monitoring.",
            "dotpe": "Avant Airtel, j'étais software engineer II chez DotPe. De 2020 à 2025, j'ai lead 4 engineers sur le billing marchand : facturation, inventaire, GST et analytics. Le food ordering a atteint 50 000 utilisateurs par jour et plus d'un crore par jour. J'ai construit la waiter app React Native et possédé le backend Node.js derrière. APIs, sync des commandes, flux offline. On a aussi shippé du chat temps réel avec Socket.io et Firebase.",
            "tyroo": "Chez Tyroo, j'ai construit l'UI des templates vidéo en React, Redux et Ant Design. Je possédais aussi le backend de génération vidéo : un service Node.js et un service Lottie qui rendait des vidéos marketing à l'échelle.",
            "meddo": "Chez Meddo Health, j'ai construit l'app patient React Native, l'app médecin, plus le produit web. Consults vidéo, chats, EMR, réservations labo. J'ai aussi écrit des APIs Node.js pour Google Auth, bulk upload et media.",
            "lotto": "Mon premier poste était chez Skill and Lotto. J'ai construit une plateforme en ligne et des outils back-office avec JavaScript, jQuery, PHP et Bootstrap.",
            "about": "Au quotidien, je fais tourner l'équipe dans Jira : planning, priorités, delivery. Je garde une barre haute sur React, TypeScript, la qualité. Je possède des services Node.js et NestJS et je travaille avec les autres engineers sur les contrats API et le design backend. Après le ship, je reste dans les logs et dashboards : Kibana, Grafana et Kong.",
            "exp-airtel": "C'est le rôle Airtel en entier. Je lead quatre engineers, on ship Next.js avec Prismic et un backend NestJS et Kong pour le load balancing, JWT, CORS et rate limiting. La vitesse vient du server-side rendering, Cloudflare caching et Web Vitals. Je possède cette surface de bout en bout, pas seulement les tickets.",
            "exp-dotpe": "DotPe, c'est un chapitre multi-produits : billing, WhatsApp marketing, live chat, la waiter app React Native, le Node.js derrière. C'était du travail lié au revenu, sur web, mobile et backend.",
            "skills": "Les skills sont groupés en frontend, backend, mobile, DevOps et leadership. React et TypeScript et Node sont le cœur. Côté backend, je possède NestJS et le service Node pour Prismic. La waiter app est en React Native, l'outil de génération vidéo tourne sur un backend Node.js. Mobile : waiter app, app patient, app médecin en React Native. Puis Express, MongoDB, SQL, AWS, Docker, Kong, Kibana et Grafana.",
            "education": "J'ai fait un B.Tech en Computer Science engineering à K.R. Mangalam University, de 2014 à 2018. Depuis, je travaille dans des product companies à Gurgaon.",
            "close": "Voilà le walkthrough. Si vous voulez discuter, email ou LinkedIn c'est le plus simple, ou vous pouvez m'appeler. Vous pouvez aussi télécharger le PDF, et relancer ça depuis l'avatar. Merci.",
        },
    },
    "es": {
        "hello": "Hola {name}. Esto es el modo asistencia. Kapil te va a explicar el currículum con su voz.",
        "helloTitle": "Modo asistencia",
        "titles": {
            "welcome": "Introducción",
            "positioning": "Lo que hago",
            "impact": "Impacto",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "Cómo trabajo",
            "exp-airtel": "Airtel — la historia completa",
            "exp-dotpe": "DotPe — la historia completa",
            "skills": "Skills",
            "education": "Formación",
            "close": "Siguiente paso",
        },
        "steps": {
            "welcome": "Hola, soy Kapil Rana, Senior Manager y SDE III en Airtel Payments Bank. Te recorro este portfolio como en una entrevista: primero el impacto, luego la tecnología.",
            "positioning": "Tengo {years} años de experiencia full-stack en React, Next.js, TypeScript, Node.js y React Native. Lideré Internet Banking para cerca de un millón de usuarios al día y gestiono un equipo de 4. He lanzado productos en 5 empresas, sobre todo fintech, commerce, publicidad, marketing.",
            "impact": "Organizo cada rol por impacto de negocio e impacto técnico. Primero, qué cambió para usuarios e ingresos, luego el stack que lo hizo posible. Empecemos por Airtel, mi rol actual.",
            "airtel": "En Airtel, soy dueño de la experiencia de internet banking bajo cumplimiento RBI. Mejoramos la velocidad de página con Next.js server-side rendering, Cloudflare caching y Core Web Vitals. Redujimos abuso de bots con Cloudflare security y Google reCAPTCHA. También soy dueño de un backend NestJS en Node.js. Delante de ese servicio corro un Kong gateway para load balancing, con plugins de CORS, JWT y rate limiting. En contenido, Next.js y Prismic se apoyan en un servicio Node.js de Prismic que yo construí. En producción uso Kibana y Grafana para logs y monitoring.",
            "dotpe": "Antes de Airtel fui software engineer II en DotPe. De 2020 a 2025 lideré a 4 engineers en billing para merchants: facturación, inventario, GST y analytics. El food ordering llegó a 50.000 usuarios al día y más de un crore al día. Construí la waiter app en React Native y fui dueño del backend Node.js detrás. APIs, sync de pedidos, flujos offline. También lanzamos chat en tiempo real con Socket.io y Firebase.",
            "tyroo": "En Tyroo construí la UI de plantillas de vídeo en React, Redux y Ant Design. También fui dueño del backend de generación de vídeo: un servicio Node.js y un servicio Lottie que renderizaba vídeos de marketing a escala.",
            "meddo": "En Meddo Health construí la app de pacientes en React Native, la app de médicos y el producto web. Consultas de vídeo, chats, EMR, reservas de laboratorio. También escribí APIs Node.js para Google Auth, bulk upload y media.",
            "lotto": "Mi primer rol fue en Skill and Lotto. Construí una plataforma online y herramientas de back-office con JavaScript, jQuery, PHP y Bootstrap.",
            "about": "En el día a día llevo al equipo en Jira: planning, prioridades y delivery. Mantengo el listón alto en React, TypeScript, calidad. Soy dueño de servicios Node.js y NestJS y trabajo con otros engineers en contratos de API y diseño de backend. Después de shipear, me quedo en logs y dashboards: Kibana, Grafana y Kong.",
            "exp-airtel": "Este es el rol completo de Airtel. Lidero a cuatro engineers, shipeamos Next.js con Prismic y un backend NestJS y Kong para load balancing, JWT, CORS y rate limiting. La velocidad viene de server-side rendering, Cloudflare caching y Web Vitals. Soy dueño de esta superficie de punta a punta, no solo de tickets.",
            "exp-dotpe": "DotPe es un capítulo multi-producto: billing, WhatsApp marketing, live chat, la waiter app en React Native, el Node.js detrás. Era trabajo ligado a ingresos, en web, mobile y backend.",
            "skills": "Los skills se agrupan en frontend, backend, mobile, DevOps y liderazgo. React y TypeScript y Node son el núcleo. En backend soy dueño de NestJS y el servicio Node para Prismic. La waiter app está en React Native y la herramienta de vídeo corre en un backend Node.js. En mobile: waiter app, app de pacientes, app de médicos en React Native. Luego Express, MongoDB, SQL, AWS, Docker, Kong, Kibana y Grafana.",
            "education": "Hice B.Tech en Computer Science engineering en K.R. Mangalam University, de 2014 a 2018. Desde entonces trabajo en product companies en Gurgaon.",
            "close": "Ese es el walkthrough. Si quieres hablar, email o LinkedIn es lo más fácil, o puedes contactarme en mi número. También puedes bajar el PDF y reiniciar esto cuando quieras desde el avatar. Gracias.",
        },
    },
    "ja": {
        "hello": "こんにちは、{name}。こちらはアシスタンスモードです。これからカピルが、自分の声で履歴書をご案内します。",
        "helloTitle": "アシスタンスモード",
        "titles": {
            "welcome": "はじめに",
            "positioning": "やっていること",
            "impact": "インパクト",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "働き方",
            "exp-airtel": "Airtel — 全体像",
            "exp-dotpe": "DotPe — 全体像",
            "skills": "スキル",
            "education": "学歴",
            "close": "次の一歩",
        },
        "steps": {
            "welcome": "こんにちは、カピル・ラナです。Airtel Payments Bank のシニアマネージャー兼 SDE III です。面接と同じように、このポートフォリオをご案内します。まず成果、それから技術です。",
            "positioning": "React、Next.js、TypeScript、Node.js、React Native で {years} 年のフルスタック経験があります。1日およそ100万人の Internet Banking を率い、4人のチームをマネジメントしています。これまでに5社で、主にフィンテック、コマース、広告、マーケティングのプロダクトを出荷してきました。",
            "impact": "各ロールをビジネスインパクトとテックインパクトで整理しています。まずユーザーと売上に何が変わったか、次にそれを可能にしたスタックです。現職の Airtel から始めます。",
            "airtel": "Airtel では、RBI コンプライアンスの下でインターネットバンキング体験をオーナーしています。Next.js のサーバーサイドレンダリング、Cloudflare のキャッシュ、Core Web Vitals でページ速度を上げました。ボット悪用は Cloudflare security と Google reCAPTCHA で減らしました。Node.js 上の NestJS バックエンドも持っています。その前段で Kong ゲートウェイを回し、ロードバランシングと CORS、JWT、レート制限のプラグインを入れています。コンテンツ側は Next.js と Prismic が、私が作った Node.js の Prismic サービスに乗っています。本番では Kibana と Grafana でログとモニタリングを見ています。",
            "dotpe": "Airtel の前は DotPe のソフトウェアエンジニア II でした。2020年から2025年まで、マーチャントの請求、請求書、在庫、GST、アナリティクスで4人のエンジニアをリードしました。フードオーダーは1日5万ユーザー、売上げは1日1クローレ超です。React Native のウェイターアプリを作り、その裏の Node.js バックエンドも持っていました。API、注文同期、オフラインフロー。Socket.io と Firebase でリアルタイムチャットも出荷しました。",
            "tyroo": "Tyroo では、React、Redux、Ant Design で動画テンプレート UI を作りました。動画生成バックエンドも持っていて、Node.js サービスと Lottie サービスでマーケティング動画をスケールレンダリングしていました。",
            "meddo": "Meddo Health では、React Native の患者アプリ、医師アプリ、それにウェブ製品を作りました。ビデオ診察、チャット、EMR、検査予約です。Google Auth、一括アップロード、メディア向けの Node.js API も書きました。",
            "lotto": "最初のロールは Skill and Lotto です。JavaScript、jQuery、PHP、Bootstrap でオンライン基盤とバックオフィスツールを作りました。",
            "about": "日常は Jira でチームを回しています。計画、優先度、デリバリー。React、TypeScript、品質のバーは高く保ちます。Node.js と NestJS のサービスを持ち、他のエンジニアと API 契約とバックエンド設計を進めます。出荷したあとも Kibana、Grafana、Kong のログとダッシュボードに残ります。",
            "exp-airtel": "これが Airtel の全体です。4人のエンジニアを率い、Next.js と Prismic、NestJS バックエンド、Kong でロードバランシング、JWT、CORS、レート制限を出荷しています。ページ速度はサーバーサイドレンダリング、Cloudflare キャッシュ、Web Vitals です。チケットだけでなく、この面を端から端まで持っています。",
            "exp-dotpe": "DotPe はマルチプロダクトの章です。請求、WhatsApp マーケティング、ライブチャット、React Native のウェイターアプリ、その裏の Node.js。売上に直結した仕事で、ウェブ、モバイル、バックエンドにまたがっています。",
            "skills": "スキルはフロントエンド、バックエンド、モバイル、DevOps、リーダーシップに分けています。核は React と TypeScript と Node です。バックエンドでは NestJS と Prismic 向けの Node サービスを持っています。ウェイターアプリは React Native、動画生成ツールは Node.js バックエンドです。モバイルはウェイター、患者、医師アプリが React Native。そのあと Express、MongoDB、SQL、AWS、Docker、Kong、Kibana、Grafana です。",
            "education": "2014年から2018年まで、K.R. Mangalam University でコンピュータサイエンス工学の B.Tech を修了しました。それ以来、グルガオンのプロダクト企業で働いています。",
            "close": "ウォークスルーは以上です。話したいときは、メールか LinkedIn が一番簡単です。番号でも連絡できます。PDF もダウンロードできます。アバターからいつでも再開できます。ありがとうございました。",
        },
    },
    "ar": {
        "hello": "مرحباً {name}. هذا وضع المساعدة. سيقوم كابيل الآن بجولة في السيرة الذاتية بصوته.",
        "helloTitle": "وضع المساعدة",
        "titles": {
            "welcome": "مقدمة",
            "positioning": "ماذا أفعل",
            "impact": "الأثر",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "كيف أعمل",
            "exp-airtel": "Airtel — القصة كاملة",
            "exp-dotpe": "DotPe — القصة كاملة",
            "skills": "المهارات",
            "education": "التعليم",
            "close": "الخطوة التالية",
        },
        "steps": {
            "welcome": "مرحباً، أنا كابيل رانا، مدير أول وSDE III في Airtel Payments Bank. أمرّ معكم على هذا المعرض كما أفعل في مقابلة: الأثر أولاً، ثم التقنيات.",
            "positioning": "لدي {years} سنوات من الخبرة الكاملة في React وNext.js وTypeScript وNode.js وReact Native. قدت Internet Banking لنحو مليون مستخدم يومياً و أدير فريقاً من 4. أطلقت منتجات في 5 شركات، غالباً في التقنية المالية والتجارة والإعلان والتسويق.",
            "impact": "أنظّم كل دور حسب الأثر التجاري والأثر التقني. أولاً ما تغيّر للمستخدمين والإيراد، ثم الـ stack الذي جعل ذلك ممكناً. لنبدأ بـ Airtel، دوري الحالي.",
            "airtel": "في Airtel أملك تجربة الإنترنت البنكي تحت التزام RBI. حسّنّا سرعة الصفحات بـ Next.js server-side rendering وتخزين Cloudflare وCore Web Vitals. خفّضنا إساءة البوتات بـ Cloudflare security وGoogle reCAPTCHA. أملك أيضاً خلفية NestJS على Node.js. أمام هذه الخدمة أشغّل بوابة Kong لموازنة الحمل، مع إضافات CORS وJWT وتحديد المعدل. في المحتوى، Next.js وPrismic يعتمدان على خدمة Node.js لـ Prismic بنيتها أنا. في الإنتاج أستخدم Kibana وGrafana للسجلات والمراقبة.",
            "dotpe": "قبل Airtel كنت مهندس برمجيات II في DotPe. من 2020 إلى 2025 قدت 4 مهندسين على فوترة التجار: الفواتير والمخزون وGST والتحليلات. طلب الطعام وصل إلى 50 ألف مستخدم يومياً وأكثر من كرور في اليوم. بنيت تطبيق النادل على React Native وملكت خلفية Node.js خلفه. واجهات برمجة، مزامنة الطلبات، وتدفقات تعمل دون اتصال. وأطلقنا أيضاً دردشة فورية بـ Socket.io وFirebase.",
            "tyroo": "في Tyroo بنيت واجهة قوالب الفيديو بـ React وRedux وAnt Design. وملكت أيضاً خلفية توليد الفيديو: خدمة Node.js وخدمة Lottie كانت ترسم فيديوهات تسويقية على نطاق واسع.",
            "meddo": "في Meddo Health بنيت تطبيق المرضى على React Native وتطبيق الطبيب بالإضافة إلى منتج الويب. استشارات فيديو، دردشات، EMR، وحجز المختبر. وكتبت أيضاً واجهات Node.js لـ Google Auth والرفع الجماعي والوسائط.",
            "lotto": "أول دور لي كان في Skill and Lotto. بنيت منصة عبر الإنترنت وأدوات للمكتب الخلفي بـ JavaScript وjQuery وPHP وBootstrap.",
            "about": "يومياً أدير الفريق في Jira: التخطيط والأولويات والتسليم. أحافظ على مستوى عالٍ في React وTypeScript والجودة. أملك خدمات Node.js وNestJS وأعمل مع مهندسين آخرين على عقود الواجهات وتصميم الخلفية. بعد الإطلاق أبقى في السجلات ولوحات المتابعة: Kibana وGrafana وKong.",
            "exp-airtel": "هذا دور Airtel كاملاً. أقود أربعة مهندسين، نطلق Next.js مع Prismic وخلفية NestJS وKong لموازنة الحمل وJWT وCORS وتحديد المعدل. سرعة الصفحة تأتي من العرض على الخادم وتخزين Cloudflare وWeb Vitals. أملك هذه المساحة من الطرف إلى الطرف، وليس التذاكر فقط.",
            "exp-dotpe": "DotPe فصل متعدد المنتجات: الفوترة، تسويق واتساب، الدردشة المباشرة، تطبيق النادل على React Native، وNode.js خلفه. كان عملاً مرتبطاً بالإيراد، عبر الويب والجوال والخلفية.",
            "skills": "المهارات موزعة على الواجهة والخلفية والجوال وDevOps والقيادة. React وTypeScript وNode هي الأساس. في الخلفية أملك NestJS وخدمة Node لـ Prismic. تطبيق النادل على React Native وأداة توليد الفيديو على خلفية Node.js. على الجوال: تطبيق النادل وتطبيق المريض وتطبيق الطبيب على React Native. ثم Express وMongoDB وSQL وAWS وDocker وKong وKibana وGrafana.",
            "education": "أنهيت بكالوريوس التقنية في هندسة علوم الحاسوب من جامعة K.R. Mangalam من 2014 إلى 2018. ومنذ ذلك الحين أعمل في شركات منتجات في جورجاون.",
            "close": "هذه هي الجولة. إذا رغبتم في الحديث، البريد أو LinkedIn الأسهل، أو يمكنكم التواصل على رقمي. يمكنكم أيضاً تنزيل PDF وإعادة تشغيل هذا في أي وقت من الصورة الرمزية. شكراً.",
        },
    },
    "hi": {
        "hello": "नमस्ते {name}. यह असिस्टेंस मोड है. कपिल अब अपनी आवाज़ में रिज्यूमे घुमाकर बताएँगे.",
        "helloTitle": "असिस्टेंस मोड",
        "titles": {
            "welcome": "परिचय",
            "positioning": "मैं क्या करता हूँ",
            "impact": "इम्पैक्ट",
            "airtel": "Airtel Payments Bank",
            "dotpe": "DotPe",
            "tyroo": "Tyroo",
            "meddo": "Meddo Health",
            "lotto": "Skill and Lotto",
            "about": "मैं कैसे काम करता हूँ",
            "exp-airtel": "Airtel — पूरी कहानी",
            "exp-dotpe": "DotPe — पूरी कहानी",
            "skills": "स्किल्स",
            "education": "शिक्षा",
            "close": "अगला कदम",
        },
        "steps": {
            "welcome": "नमस्ते, मैं कपिल राणा हूँ, Airtel Payments Bank में सीनियर मैनेजर और SDE III. मैं इस पोर्टफोलियो को इंटरव्यू की तरह घुमाऊँगा: पहले इम्पैक्ट, फिर टेक्नोलॉजी.",
            "positioning": "मेरे पास React, Next.js, TypeScript, Node.js और React Native में {years} साल का फुल-स्टैक अनुभव है. मैंने Internet Banking को लगभग दस लाख यूज़र्स प्रति दिन के लिए लीड किया और 4 लोगों की टीम मैनेज करता हूँ. मैंने 5 कंपनियों में प्रोडक्ट शिप किए हैं, ज़्यादातर फिनटेक, कॉमर्स, एडवरटाइज़िंग, मार्केटिंग में.",
            "impact": "मैं हर रोल को बिज़नेस इम्पैक्ट और टेक्निकल इम्पैक्ट से व्यवस्थित करता हूँ. पहले यूज़र्स और रेवेन्यू में क्या बदला, फिर वो स्टैक जिससे यह मुमकिन हुआ. चलो Airtel से शुरू करते हैं, मेरी करंट रोल.",
            "airtel": "Airtel पर मैं RBI कंप्लायंस के तहत इंटरनेट बैंकिंग एक्सपीरियंस का ओनर हूँ. हमने पेज स्पीड Next.js सर्वर-साइड रेंडरिंग, Cloudflare कैशिंग और Core Web Vitals से सुधारी. बॉट अबा्यूज Cloudflare सिक्योरिटी और Google reCAPTCHA से घटाया. मेरे पास NestJS बैकएंड भी है, Node.js पर. उसके सामने मैं Kong गेटवे चलाता हूँ लोड बैलेंसिंग के लिए, CORS, JWT और रेट लिमिटिंग प्लगइन्स के साथ. कंटेंट साइड पर Next.js और Prismic मेरे बनाए Node.js Prismic सर्विस पर बैठते हैं. प्रोडक्शन में मैं Kibana और Grafana से लॉग्स और मॉनिटरिंग देखता हूँ.",
            "dotpe": "Airtel से पहले मैं DotPe में सॉफ्टवेयर इंजीनियर II था. 2020 से 2025 तक मैंने मर्चेंट बिलिंग, इनवॉइसिंग, इन्वेंटरी, GST और एनालिटिक्स पर 4 इंजीनियर्स लीड किए. फूड ऑर्डरिंग 50,000 डेली यूज़र्स और एक करोड़ से ऊपर प्रति दिन पहुँची. मैंने React Native वेटर ऐप बनाया और उसके पीछे का Node.js बैकएंड ओन किया. APIs, ऑर्डर सिंक, ऑफलाइन फ्लो. हमने Socket.io और Firebase से रियल-टाइम चैट भी शिप की.",
            "tyroo": "Tyroo पर मैंने वीडियो टेम्पलेट UI React, Redux और Ant Design में बनाया. वीडियो जनरेशन बैकएंड भी मेरा था: एक Node.js सर्विस और एक Lottie सर्विस जो मार्केटिंग वीडियो स्केल पर रेंडर करती थी.",
            "meddo": "Meddo Health पर मैंने React Native पेशेंट ऐप, डॉक्टर ऐप और वेब प्रोडक्ट बनाया. वीडियो कंसल्ट, चैट, EMR, लैब बुकिंग. Google Auth, बल्क अपलोड और मीडिया के लिए Node.js APIs भी लिखी.",
            "lotto": "मेरी पहली रोल Skill and Lotto पर थी. मैंने JavaScript, jQuery, PHP और Bootstrap से ऑनलाइन प्लेटफ़ॉर्म और बैक-ऑफिस टूल्स बनाए.",
            "about": "रोज़मर्रा मैं टीम को Jira में चलाता हूँ: प्लानिंग, प्राथमिकताएँ, डिलीवरी. React, TypeScript, क्वालिटी पर बार ऊँचा रखता हूँ. Node.js और NestJS सर्विसेस ओन करता हूँ और दूसरे इंजीनियर्स के साथ API कॉन्ट्रैक्ट्स और बैकएंड डिज़ाइन करता हूँ. शिप के बाद लॉग्स और डैशबोर्ड में रहता हूँ: Kibana, Grafana और Kong.",
            "exp-airtel": "यह पूरी Airtel रोल है. मैं चार इंजीनियर्स लीड करता हूँ, हम Next.js with Prismic और NestJS बैकएंड और Kong शिप करते हैं लोड बैलेंसिंग, JWT, CORS और रेट लिमिटिंग के लिए. पेज स्पीड सर्वर-साइड रेंडरिंग, Cloudflare कैशिंग और Web Vitals से आती है. मैं इस सरफेस को एंड-टू-एंड ओन करता हूँ, सिर्फ़ टिकट नहीं.",
            "exp-dotpe": "DotPe एक मल्टी-प्रोडक्ट चैप्टर है: बिलिंग, WhatsApp मार्केटिंग, लाइव चैट, React Native वेटर ऐप, उसके पीछे Node.js. यह रेवेन्यू से जुड़ा काम था, वेब, मोबाइल और बैकएंड पर.",
            "skills": "स्किल्स फ्रंटएंड, बैकएंड, मोबाइल, DevOps और लीडरशिप में बँटे हैं. React और TypeScript और Node कोर हैं. बैकएंड पर मेरे पास NestJS और Prismic के लिए Node सर्विस है. वेटर ऐप React Native पर है और वीडियो जनरेशन टूल Node.js बैकएंड पर. मोबाइल पर वेटर ऐप, पेशेंट ऐप, डॉक्टर ऐप React Native पर. फिर Express, MongoDB, SQL, AWS, Docker, Kong, Kibana और Grafana.",
            "education": "मैंने 2014 से 2018 तक K.R. Mangalam University से कंप्यूटर साइंस इंजीनियरिंग में B.Tech पूरा किया. तब से मैं गुरुग्राम की प्रोडक्ट कंपनियों में काम कर रहा हूँ.",
            "close": "यह वॉकथ्रू था. बात करनी हो तो ईमेल या LinkedIn सबसे आसान है, या मेरे नंबर पर संपर्क कर सकते हो. PDF भी डाउनलोड कर सकते हो, और अवतार से कभी भी रीस्टार्ट कर सकते हो. धन्यवाद.",
        },
    },
}


def years_exp(today: date | None = None) -> int:
    today = today or date.today()
    return max(1, round((today - CAREER_START).days / 365.25))


def fill_years(text: str, year: int) -> str:
    return text.replace("{years}", str(year))


def fill_name(text: str, name: str) -> str:
    return text.replace("{name}", name)


def encode_mp3(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-af",
            (
                "equalizer=f=160:t=q:w=0.8:g=1.4,"
                "equalizer=f=350:t=q:w=1.0:g=-1.6,"
                "equalizer=f=2700:t=q:w=1.05:g=1.8,"
                "acompressor=threshold=-18dB:ratio=2.1:attack=12:release=160:makeup=2.2,"
                "loudnorm=I=-16:TP=-1.5:LRA=11,"
                "alimiter=limit=0.94:attack=6:release=60"
            ),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "3",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


async def synthesize(text: str, voice: str, rate: str, dest: Path, attempts: int = 4):
    last = None
    for attempt in range(attempts):
        try:
            comm = Communicate(text, voice, rate=rate, boundary="WordBoundary")
            audio = bytearray()
            words = []
            async for chunk in comm.stream():
                kind = chunk.get("type")
                if kind == "audio":
                    audio.extend(chunk["data"])
                elif kind == "WordBoundary":
                    words.append(
                        {
                            "t": round(chunk["offset"] / 10_000_000, 3),
                            "w": chunk["text"],
                        }
                    )
            if not audio:
                raise RuntimeError("empty audio")
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                raw = Path(tmp.name)
            raw.write_bytes(bytes(audio))
            try:
                encode_mp3(raw, dest)
            finally:
                raw.unlink(missing_ok=True)
            if dest.stat().st_size < 800:
                raise RuntimeError("tiny mp3")
            return words
        except Exception as err:
            last = err
            await asyncio.sleep(1.1 * (attempt + 1))
    raise last


def sync_locales() -> None:
    for lang, pack in SCRIPTS.items():
        path = LOCALE_DIR / f"{lang}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        story = data.setdefault("story", {})
        story["hello"] = pack["hello"]
        story["helloTitle"] = pack["helloTitle"]
        steps = {}
        for sid in STEP_ORDER:
            steps[sid] = {
                "title": pack["titles"][sid],
                "text": pack["steps"][sid],
            }
        story["steps"] = steps
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("locale", path.name)


async def render_lang(lang: str, sem: asyncio.Semaphore, year_now: int) -> None:
    voice, rate = VOICES[lang]
    pack = SCRIPTS[lang]
    out = VOICE_DIR / lang
    (out / "hello").mkdir(parents=True, exist_ok=True)
    (out / "years").mkdir(parents=True, exist_ok=True)

    texts = {}
    words_map = {}
    hellos = {}
    variants = {}

    async def job(label: str, text: str, dest: Path):
        async with sem:
            print(f"{lang}  {label}")
            w = await synthesize(text, voice, rate, dest)
            return w

    tasks = []
    meta = []
    for sid in STEP_ORDER:
        spoken = fill_years(pack["steps"][sid], year_now)
        dest = out / f"{sid}.mp3"
        tasks.append(job(sid, spoken, dest))
        meta.append(("step", sid, pack["steps"][sid], dest))

    for year in range(YEAR_FROM, YEAR_TO + 1):
        spoken = fill_years(pack["steps"]["positioning"], year)
        dest = out / "years" / f"positioning-{year}.mp3"
        tasks.append(job(f"year-{year}", spoken, dest))
        meta.append(("year", year, spoken, dest))

    for slug, spoken_name in COMPANIES.items():
        spoken = fill_name(pack["hello"], spoken_name)
        dest = out / "hello" / f"{slug}.mp3"
        tasks.append(job(f"hello-{slug}", spoken, dest))
        meta.append(("hello", slug, spoken, dest))

    results = await asyncio.gather(*tasks)
    for item, words in zip(meta, results):
        kind = item[0]
        if kind == "step":
            _, sid, template, dest = item
            texts[sid] = template
            words_map[sid] = words
        elif kind == "year":
            _, year, spoken, dest = item
            variants[str(year)] = {
                "audio": f"years/positioning-{year}.mp3?v={CACHE_BUST}",
                "text": spoken,
                "words": words,
            }
        else:
            _, slug, spoken, dest = item
            hellos[slug] = {
                "audio": f"hello/{slug}.mp3?v={CACHE_BUST}",
                "text": spoken,
                "words": words,
            }

    payload = {
        "lang": lang,
        "years": year_now,
        "careerStart": CAREER_START.isoformat(),
        "yearFrom": YEAR_FROM,
        "yearTo": YEAR_TO,
        "voice": voice,
        "source": "edge-tts",
        "texts": texts,
        "words": words_map,
        "hellos": hellos,
        "yearVariants": {"positioning": variants},
    }
    (out / "words.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", out / "words.json")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", action="append", dest="langs")
    parser.add_argument("--locales-only", action="store_true")
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()

    sync_locales()
    if args.locales_only:
        return

    langs = args.langs or list(VOICES)
    for lang in langs:
        if lang not in VOICES:
            raise SystemExit(f"unsupported lang {lang}")

    year_now = years_exp()
    sem = asyncio.Semaphore(max(1, args.concurrency))
    for lang in langs:
        await render_lang(lang, sem, year_now)


if __name__ == "__main__":
    asyncio.run(main())
