# Mise en place Neon Prisma

On va utiliser une base de donnée Neon. Prisma va servir d'intermediare entre la solution et la base de données.

1. Créer un projet qui va contenir la base de données du projet sur Neon

2. Initialiser prisma dans le projet.
   Pour initialier le dossier prisma, on tape la commande

```shell
    npm i prisma @prisma/client
    npx prisma init
    # installer l'extension Prisma (prisma.io) pour avoir de l'autocompletion 
```

Copier/coller le contenu du fichier schema.prisma dans le fichier correspondant dans le projet (prisma/schema.prisma).

Generer le prisma client

```shell
    npx prisma generate
    # faire la migration pour transformer le schema en base de données
    npx prisma migrate dev --name init
    # cela va créer un dossier migration avec un sous dossier qui contient un fichier sql et la migration
```

script package.json
"format": "prettier --writ \"scr/**/*.ts\" \"test/**/*.ts\",
installer au préalable le package prettier