# RedGreenGoWeb

Web implementation of the [RedGreenGo coaching game](https://github.com/redgreengo)

# Play https://kenpower.github.io/RedGreenGoWeb/

# Teachers

- [TEACHERS.md](TEACHERS.md): running a class (class codes, what's stored, progress, limits)
- [STUDENTS.md](STUDENTS.md): a one-page quick start to hand to students
- [AUTHORING.md](AUTHORING.md): writing an exercise in its own repo (README format, worksheet steps, checking it with `scripts/check_exercise.mjs`)

Todo:

- [] fizbuzz solution

# Developers

### run in dev mode

`npm run dev`

### deploy

`npm run release` (`./release.sh`, add `--pwd` to type the server's sudo password) ships everything,
from a clean `main`: runs the tests, pushes, deploys the coach server ([deploy.sh](deploy.sh), see
[coach/deploy/README.md](coach/deploy/README.md)), then builds the web app and publishes it to GitHub Pages
(`docs/`). The coach goes first, so a new web app never talks to an old coach.

Just the web app: `npm run publish`. Just the coach: `./deploy.sh`.

![image](https://user-images.githubusercontent.com/105429/150814522-891d8e49-e551-44f9-9dec-a79aae7b6942.png)

### test

`npm run test`
