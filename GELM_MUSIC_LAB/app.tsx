import { useEffect, useState } from "react";

const ASSET = "https://ext.same-assets.com/195461215";

function Icon({ name, size = 18 }: { name: "play" | "pause" | "arrow" | "plus" | "menu" | "close" | "check" | "chevron" | "spark"; size?: number }) {
  const paths = {
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" />,
    pause: <><path d="M8 5h3v14H8z" fill="currentColor"/><path d="M15 5h3v14h-3z" fill="currentColor"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    menu: <><path d="M4 8h16"/><path d="M4 16h16"/></>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    spark: <path d="m12 3 1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9L12 3Z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const tracks = [
  { title: "1nes and zer0s", artist: "INJURY", plays: "528K", art: `${ASSET}/3963228610.webp`, tone: "rust" },
  { title: "deadstar", artist: "madebyanubis", plays: "371K", art: `${ASSET}/3573864744.webp`, tone: "cream" },
  { title: "Stay or Leave", artist: "M.F[T.O] Beats", plays: "254K", art: `${ASSET}/4277065667.jpeg`, tone: "amber" },
  { title: "Dancing With My Eyes Closed", artist: "Raymond", plays: "384K", art: `${ASSET}/2107761695.jpeg`, tone: "red" },
  { title: "pick [n]one", artist: "MC Escher", plays: "392K", art: `${ASSET}/3916462203.jpeg`, tone: "gold" },
  { title: "Porch Light On", artist: "kealix", plays: "463K", art: `${ASSET}/971927431.webp`, tone: "tan" },
];

const features = [
  { kicker: "10 free songs, daily", text: "Turn any moment into customized music instantly—from your commute to inside jokes. Express what words can't.", art: `${ASSET}/2932514276.png` },
  { kicker: "Free AI music generator", text: "Discover what's possible when anyone can make music. Explore millions of songs, remixes, jokes, and raw emotion.", art: `${ASSET}/3028591071.png` },
  { kicker: "Share it with the world", text: "Make music that matters to you, then share it with people who'll feel it too.", art: `${ASSET}/4026718836.png` },
];

const planDetails = {
  Free: ["Access to our free models", "50 credits per day", "Standard features only", "Upload up to 8 min of audio", "Shared creation queue"],
  Pro: ["Access to our best models", "2,500 credits per month", "20 song downloads per month", "Commercial use rights", "Standard + Pro features", "Priority queue; up to 10 songs at once"],
  Premier: ["Access to Suno Studio", "10,000 credits per month", "60 song downloads per month", "Commercial use rights", "Advanced stem separation", "Early access to new features"],
};

const faqs = [
  ["What makes Suno different from other AI music generators?", "Most AI music generators produce short instrumental loops. Suno helps you create complete, original songs—vocals, lyrics, and full production—from a single text prompt in under a minute, across every genre."],
  ["How do I make a song with Suno?", "Describe the song you want: genre, mood, theme, or your own lyrics, then hit Create. From there you can regenerate, extend, or refine your track."],
  ["Do I need music experience to use Suno?", "No experience needed. Suno is built for everyone, from people making music for the first time to working songwriters and producers."],
  ["Can AI really create a full song?", "Yes. Start with a genre, mood, or idea and build a full track with vocals, lyrics, instrumentation, and production."],
  ["Is Suno free to use?", "Yes. The free tier lets you create songs daily, with paid plans available for more credits, advanced tools, and commercial rights."],
];

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const prompts = ["quitting your job", "dancing through heartbreak", "a midnight drive", "your best friend's wedding"];

  useEffect(() => {
    const timer = window.setInterval(() => setPromptIndex((value) => (value + 1) % prompts.length), 2800);
    return () => window.clearInterval(timer);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <main>
      <section className="hero" id="top">
        <nav className="nav shell">
          <button className="wordmark" onClick={() => scrollTo("top")} aria-label="Suno home">Suno</button>
          <div className={`nav-links ${mobileOpen ? "open" : ""}`}>
            <button onClick={() => scrollTo("features")}>Studio</button>
            <button onClick={() => scrollTo("pricing")}>Pricing</button>
            <button onClick={() => scrollTo("footer")}>Careers</button>
          </div>
          <button className="nav-cta" onClick={() => scrollTo("pricing")}>Make a song <Icon name="arrow" /></button>
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation"><Icon name={mobileOpen ? "close" : "menu"} size={24} /></button>
        </nav>

        <div className="hero-track hero-track-left">
          <img src={tracks[0].art} alt="1nes and zer0s cover" />
          <button onClick={() => setPlaying(playing === 0 ? null : 0)}><Icon name={playing === 0 ? "pause" : "play"} size={15}/></button>
          <span><strong>{tracks[0].title}</strong>{tracks[0].artist}</span>
        </div>
        <div className="hero-track hero-track-right">
          <img src={tracks[1].art} alt="deadstar cover" />
          <button onClick={() => setPlaying(playing === 1 ? null : 1)}><Icon name={playing === 1 ? "pause" : "play"} size={15}/></button>
          <span><strong>{tracks[1].title}</strong>{tracks[1].artist}</span>
        </div>

        <div className="hero-copy shell">
          <p className="eyebrow">Ideas become music</p>
          <h1>Make a <em>house song</em><br />about <span key={promptIndex}>{prompts[promptIndex]}</span></h1>
          <p className="hero-sub">Start with a simple prompt or dive into our pro editing tools.<br/>Your next track is just a step away.</p>
          <button className="primary-btn" onClick={() => scrollTo("features")}><Icon name="spark"/> Start creating <Icon name="arrow"/></button>
        </div>
        <div className="scroll-note">Scroll to discover <span>↓</span></div>
      </section>

      <section className="press">
        <p>Heard around the world</p>
        <div className="press-loop">
          <span>COMPLEX</span><span className="editorial-logo">Rolling Stone</span><span>WIRED</span><span>VARIETY</span><span>billboard</span><span>FORBES</span>
        </div>
      </section>

      <section className="quality-section">
        <div className="section-heading shell">
          <p className="eyebrow">Your sound, fully realized</p>
          <h2>Mind blowing<br/><em>song quality</em></h2>
          <p>Whether you have a melody in your head, lyrics you've written, or just a feeling you want to hear—high-quality music creation is open to all.</p>
        </div>
        <div className="track-marquee">
          <div className="track-row">
            {tracks.concat(tracks.slice(0, 3)).map((track, index) => (
              <article className={`song-card ${track.tone}`} key={`${track.title}-${index}`}>
                <div className="song-art"><img src={track.art} alt="" /><button onClick={() => setPlaying(playing === index ? null : index)} aria-label={`Play ${track.title}`}><Icon name={playing === index ? "pause" : "play"}/></button></div>
                <div className="song-meta"><div><strong>{track.title}</strong><span>{track.artist}</span></div><small>{track.plays}</small></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-heading centered shell">
          <p className="eyebrow">Built for every kind of creator</p>
          <h2>Everything you need<br/>to make music <em>your way</em></h2>
        </div>
        <div className="feature-grid shell">
          {features.map((feature, index) => (
            <article className={`feature-card feature-${index + 1}`} key={feature.kicker}>
              <div className="feature-copy"><span>0{index + 1}</span><h3>{feature.kicker}</h3><p>{feature.text}</p></div>
              <img src={feature.art} alt="" />
            </article>
          ))}
        </div>
        <div className="capability-list shell">
          {[
            ["Granular creation controls", "Steer your style with voices, inspirations, exclusions and detailed creative controls."],
            ["Commercial rights to your songs", "Songs made as a paid subscriber are yours to use—from videos to a published album."],
            ["Your complete creative workspace", "A generative audio workstation combining traditional production with AI music creation."],
            ["Extract stems. Drop into your DAW.", "Export time-aligned WAV stems for Ableton, Logic, or any professional workflow."],
          ].map(([title, text], index) => <article key={title}><span>0{index + 4}</span><h3>{title}</h3><p>{text}</p><button aria-label={`Learn about ${title}`}><Icon name="arrow"/></button></article>)}
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="pricing-head shell">
          <div><p className="eyebrow">Pick your frequency</p><h2>Start making<br/>music <em>for free</em></h2></div>
          <div className="billing"><button className={!yearly ? "active" : ""} onClick={() => setYearly(false)}>Monthly</button><button className={yearly ? "active" : ""} onClick={() => setYearly(true)}>Yearly <span>save 20%</span></button></div>
        </div>
        <div className="plans shell">
          {(Object.keys(planDetails) as Array<keyof typeof planDetails>).map((name, index) => {
            const prices = yearly ? ["$0", "$8", "$24"] : ["$0", "$10", "$30"];
            return <article className={`plan ${name === "Pro" ? "featured" : ""}`} key={name}>
              {name === "Pro" && <div className="popular">Most popular</div>}
              <div className="plan-top"><span>0{index + 1}</span><h3>{name}</h3><p>{name === "Free" ? "Our starter plan." : name === "Pro" ? "Our best models and editing tools." : "Maximum credits. Every feature."}</p></div>
              <div className="price"><strong>{prices[index]}</strong><span>/month</span></div>
              <button onClick={() => window.alert(`${name} plan selected — this demo does not process sign-ups.`)}>{name === "Free" ? "Start creating" : `Choose ${name}`} <Icon name="arrow"/></button>
              <ul>{planDetails[name].map((item) => <li key={item}><Icon name="check" size={16}/>{item}</li>)}</ul>
            </article>;
          })}
        </div>
      </section>

      <section className="app-section">
        <div className="app-copy shell"><p className="eyebrow">Make music anywhere</p><h2>The #1<br/><em>AI music app</em></h2><p>Discover, create, and share from anywhere—because music has no boundaries.</p><div className="ratings"><div><strong>4.9</strong><span>App Store · 363k+ reviews</span></div><div><strong>4.8</strong><span>Google Play · 653k+ reviews</span></div></div></div>
        <div className="phone" aria-label="Suno mobile app preview"><div className="phone-bar">9:41 <span>● ●</span></div><h3>Trending now</h3><img src={`${ASSET}/3759767780.png`} alt="Music app artwork"/><div className="phone-player"><button><Icon name="play"/></button><div><strong>Anything you dream</strong><span>Made with Suno</span></div></div></div>
      </section>

      <section className="community-section">
        <div className="section-heading centered shell"><p className="eyebrow">A world of new sound</p><h2>Explore and<br/><em>get inspired</em></h2><p>Join millions of creators making songs, remixing tracks, and sharing music freely.</p></div>
        <div className="creator-grid shell">
          {[['3856895542.png','@timbaland'],['3482343672.png','@spellspellspell'],['3659524038.png','@nickfloats'],['1292785304.png','@milesmusickid']].map(([art, name], index) => <article key={name}><img src={`${ASSET}/${art}`} alt=""/><div><span>{name}</span><button onClick={() => setPlaying(playing === 20 + index ? null : 20 + index)}><Icon name={playing === 20 + index ? "pause" : "play"}/></button></div></article>)}
        </div>
      </section>

      <section className="faq-section shell">
        <div className="faq-title"><p className="eyebrow">Questions, answered</p><h2>Frequently<br/>asked <em>questions</em></h2><p>Everything you need to know about making music.</p></div>
        <div className="faq-list">{faqs.map(([question, answer], index) => <article className={openFaq === index ? "open" : ""} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><Icon name={openFaq === index ? "close" : "plus"}/></button><div><p>{answer}</p></div></article>)}</div>
      </section>

      <footer id="footer">
        <div className="footer-cta shell"><h2>Every song starts<br/>with <em>an idea.</em></h2><button className="primary-btn" onClick={() => scrollTo("top")}>Make your first song <Icon name="arrow"/></button></div>
        <div className="footer-main shell"><div className="footer-brand"><button className="wordmark" onClick={() => scrollTo("top")}>Suno</button><p>Make any song you can imagine.</p></div><div><strong>Brand</strong><a href="#top">About</a><a href="#footer">Careers</a><a href="#features">Blog</a><a href="#pricing">Pricing</a></div><div><strong>Support</strong><a href="#faq">Help</a><a href="#footer">Contact us</a><a href="#footer">Community guidelines</a><a href="#footer">Privacy</a></div></div>
        <div className="legal shell"><span>© 2026 Suno, Inc.</span><span>UI recreation for demonstration purposes</span></div>
      </footer>
    </main>
  );
}

export default App;
