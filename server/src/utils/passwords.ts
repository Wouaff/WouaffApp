/* Refus des mots de passe trop courants ou trop liés au compte. La liste couvre les mots de passe les plus
   utilisés (anglais et français) : c'est ce que testent en premier les attaques par dictionnaire. */
const COMMON = new Set(
  `password passw0rd p@ssw0rd p@ssword motdepasse motdepasse1 mdp mdp123 azerty azertyuiop azerty123 qwerty qwertyuiop
qwerty123 qwertz azertyui 123456 1234567 12345678 123456789 1234567890 12345678910 0123456789 987654321 87654321 111111
11111111 000000 00000000 121212 123123 123321 654321 666666 696969 112233 123654 147258 147258369 159753 abc123 abcd1234
abcdefgh abcdefg1 1q2w3e4r 1q2w3e4r5t 1qaz2wsx 1qazxsw2 zaq12wsx qazwsx qazwsxedc zxcvbnm asdfghjkl asdfghjk asdf1234
iloveyou iloveyou1 jetaime jetaime1 tuseras bonjour bonjour1 bonjour123 salut salut123 coucou coucou123 soleil soleil1
doudou chouchou loulou doudoune chocolat chocolat1 marseille paris paris75 paris2020 france france1 france123 liverpool
football football1 foot foot123 psgpsg monkey dragon master hello hello123 welcome welcome1 letmein letmein1 admin admin123
administrator root toor login login123 changeme changeit secret secret123 test test123 test1234 testtest user user123
princess sunshine shadow superman batman trustno1 michael jordan jennifer hunter ranger buster thomas robert daniel
charlie freedom whatever qazwsx123 pokemon naruto minecraft fortnite wouaff wouaff1 wouaff123 azerty12 azerty1234
motdepasse123 password1 password12 password123 password1234 passwort 1234abcd a1b2c3d4 qwe123 qwe12345 qweasdzxc
q1w2e3r4 q1w2e3r4t5 zxcvbn123 mypassword mypassword1 default guest guest123 temp temp123 pass pass123 pass1234 pa55word
pa$$word baseball basketball starwars lovely lovely1 monkey1 dragon1 football123 iloveu 00000001 1111111111 2222222222
aaaaaaaa bbbbbbbb aaaa1111 abcabc123 azerty0 azerty01 azerty69 rootroot adminadmin userpass motdepasse2024 motdepasse2025
motdepasse2026 password2024 password2025 password2026 bienvenue bienvenue1 bienvenue123 liberte egalite fraternite`
    .split(/\s+/)
    .filter(Boolean),
);

const SEQUENCES = [
  '0123456789',
  '9876543210',
  'abcdefghijklmnopqrstuvwxyz',
  'azertyuiopqsdfghjklmwxcvbn',
  'qwertyuiopasdfghjklzxcvbnm',
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const COMMON_PASSWORD_ERROR = 'Ce mot de passe est trop courant ou trop facile à deviner, choisis-en un autre';

/** Renvoie un message d'erreur si le mot de passe est trop faible, sinon null. */
export function passwordProblem(password: string, context: { pseudo?: string; email?: string } = {}): string | null {
  const p = normalize(password);
  /* Même mot de passe avec des chiffres ou signes ajoutés à la fin (« password123! »). */
  const stripped = p.replace(/[\d!?.@#$*_-]+$/, '');
  if (COMMON.has(p) || (stripped.length >= 4 && COMMON.has(stripped))) return COMMON_PASSWORD_ERROR;
  /* Un seul caractère répété, ou suite évidente du clavier / de l'alphabet / des chiffres. */
  if (new Set(p).size <= 2) return COMMON_PASSWORD_ERROR;
  if (SEQUENCES.some((seq) => seq.includes(p) && p.length >= 6)) return COMMON_PASSWORD_ERROR;
  const pseudo = normalize(context.pseudo ?? '');
  const local = normalize((context.email ?? '').split('@')[0] ?? '');
  for (const part of [pseudo, local]) {
    if (part.length >= 4 && (p === part || stripped === part || p.includes(part))) {
      return 'Le mot de passe ne doit pas contenir ton pseudo ni ton adresse e-mail';
    }
  }
  return null;
}
