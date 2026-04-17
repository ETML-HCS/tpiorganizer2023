# 🔐 Checklist Configuration Production - TPI Organizer

**Date d'audit** : 9 avril 2026  
**Statut** : ✅ À vérifier avant déploiement

---

## 🚨 Issues Critiques

### 1. **Auth Bypass Developer Mode Actif**
- **Fichier** : [API/middleware/appAuth.js](API/middleware/appAuth.js#L70)
- **Problème** : Lignes 70-76 permettent de contourner TOUTE l'authentification si :
  - `SKIP_APP_AUTH=true` ET
  - `REACT_APP_DEBUG=true`
- **Impact** : N'importe qui peut accéder à l'API sans authentification
- **✅ Action** : **VÉRIFIER QUE CES VARIABLES SONT FALSE OU ABSENT EN PROD**

```bash
# ❌ DANGEREUSE EN PROD
SKIP_APP_AUTH=true
REACT_APP_DEBUG=true

# ✅ CORRECT EN PROD
# Ces variables doivent être absent ou à false
```

### 2. **Pas de Validation d'Entrée**
- **Fichier** : API endpoints POST/PUT
- **Problème** : Aucune validation sur les données entrantes
- **Impact** : Injection NoSQL, XSS, données corrompues
- **✅ Action rapide** : Ajouter validation globale avec middleware

```javascript
// Ajouter middleware de validation
app.use(express.json({ limit: '10mb' }))
const { body, validationResult } = require('express-validator')
```

---

## 🔧 Configuration Requise (Variables d'Environnement)

### Auth
```bash
# Credentials pour login admin
AUTH_USER_HASH=<bcrypt_hash_du_username>  # OU AUTH_USER_PLAIN=<username>
AUTH_PASS_HASH=<bcrypt_hash_du_password>  # OU AUTH_PASS_PLAIN=<password>
AUTH_SESSION_SECRET=<secret_aleatoire_64_chars>

# ⚠️ JAMAIS en production :
# SKIP_APP_AUTH=true
# REACT_APP_DEBUG=true
```

### Base de Données
```bash
# MongoDB Atlas OU LOCAL
DB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
# OU (local)
DB_CLUSTER=localhost:27017
DB_NAME=tpiorganizer
DB_USERNAME=user
DB_PASSWORD=pass
```

### Email SMTP
```bash
# Production (vrai serveur SMTP)
NODE_ENV=production
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=noreply@example.com
SMTP_PASS=<password>
SMTP_FROM="TPI Organizer" <noreply@example.com>

# Développement (Ethereal ou Mailtrap)
NODE_ENV=development
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<ethereal_user>
SMTP_PASS=<ethereal_pass>
```

### Frontend
```bash
REACT_APP_API_URL=https://api.example.com/api
REACT_APP_DEBUG=false  # ⚠️ JAMAIS true en prod
```

### Serveur
```bash
PORT=6000                    # Port d'écoute
NODE_ENV=production         # Activez la prod
CORS_ORIGIN=https://example.com  # ⚠️ Restreindre CORS
```

---

## ✅ Éléments à Vérifier

| Item | Statut | Action |
|------|--------|--------|
| Auth bypass désactivé | ⚠️ À vérifier | Variables `SKIP_APP_AUTH`, `REACT_APP_DEBUG` → false/absent |
| Secrets JWT générés | ⚠️ À faire | Générer `AUTH_SESSION_SECRET` aléatoire (64 chars) |
| DB credentials | ⚠️ À vérifier | Tester connexion MongoDB en prod |
| SMTP configuré | ⚠️ À vérifier | SMTP_HOST, SMTP_USER, SMTP_PASS définis |
| Validation entrées | ⚠️ À améliorer | Ajouter express-validator sur endpoints POST/PUT |
| Rate limiting | ❌ Manquant | Ajouter express-rate-limit |
| CORS whitelist | ⚠️ À restreindre | Définir CORS_ORIGIN au lieu de `*` |
| Logs de prod | ✅ Nettoyé | Console.log debug supprimés |
| Tests critiques | ❌ Minimal (4 tests) | À augmenter |

---

## 🚀 Deployment Checklist

```bash
# 1. Préparer le fichier .env.production
cp .env.example .env.production
# Éditer avec vraies valeurs de production

# 2. Vérifier les variables critiques
npm run check-env-prod

# 3. Tester auth
curl -X POST http://localhost:6000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'

# 4. Tester email (vrai SMTP)
npm run test:email

# 5. Déployer
npm run build
npm start
```

---

## 📝 Notes

- **PDF Hardcodé** : [API/serverAPI.js L79](API/serverAPI.js#L79) utilise `./models/mEvalV3.pdf` → À configurer via variable d'env
- **Collections MongoDB** : Une par année au lieu de champ `year` → À refactoriser pour scalabilité
- **Pagination manquante** : GET `/api/get-tpi` retourne tout → Ajouter limits
- **Magic Links** : Vérifier les liens d'expiration pour prod

---

## 🔗 Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)
