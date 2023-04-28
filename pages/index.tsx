import Head from 'next/head'
import { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css'

import repositories from "../repositories.json";

import SelectSearch from 'react-select-search';

import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

type RepositoryData = {
  repository: string,
  downloadURL: string,
}

async function getRandomRepository(
  skip: string[],
): Promise<RepositoryData> {
  const pickFrom = repositories.filter((r) => !skip.includes(r));

  const repository = pickFrom[Math.floor(Math.random() * pickFrom.length)];

  const repositoryResponse = await fetch(
    `https://api.github.com/repos/${repository}`,
    {
      referrerPolicy: 'no-referrer',
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  const repositoryJSON = await repositoryResponse.json();
  const defaultBranch: string = repositoryJSON.default_branch;

  const treeResponse = await fetch(
    `https://api.github.com/repos/${repository}/git/trees/${defaultBranch}?recursive=1`,
    {
      referrerPolicy: 'no-referrer',
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  const treeJSON = await treeResponse.json();
  const files = treeJSON.tree.filter(
    (item: { type: string; }) => item.type == 'blob');
  const randomFile = files[Math.floor(Math.random() * files.length)];

  // Rarely (say, 1 in 100) we get an error here because `randomFile` is undefined.
  // To ship this, I'm just adding some retry logic. TODO: fix me.
  if (randomFile === undefined) {
    return getRandomRepository(skip)
  }

  const { path } = randomFile;
  const downloadURL =
    `https://raw.githubusercontent.com/${repository}/${defaultBranch}/${path}`;

  return {
    repository,
    downloadURL,
  };
}

export default function Home() {
  const maxStage = 10
  const loadingMessage = 'loading..'

  const [gameComplete, setGameComplete] = useState(false)
  const [stage, setStage] = useState(1)
  const [score, setScore] = useState(0)
  const [guessText, setGuessText] = useState('')
  const [winText, setWinText] = useState('')
  const [seenRepositories, setSeenRepositories] = useState<string[]>([])
  const [repositoryData, setRepositoryData] = useState<RepositoryData | null>(null)
  const [snippet, setSnippet] = useState(loadingMessage)
  const searchItems = repositories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map((name) => Object({ name, value: name }))

  const guess = (skip = false) => {
    let choice = ''
    if (!skip) {
      // TODO: fix me not to use document state!
      choice = document.querySelector('#repository-search')?.querySelector('input')?.value as string
    }

    if (choice.toLowerCase() === repositoryData?.repository.toLowerCase()) {
      setScore(score + 1)
      setGuessText(`Correct! The last snippet was from ${repositoryData?.repository}.`)
    } else if (skip === false) {
      setGuessText(`Incorrect! The last snippet was from ${repositoryData?.repository}.`)
    } else {
      // A nicer message when skipping
      setGuessText(`The last snippet was from ${repositoryData?.repository}.`)
    }

    if (stage + 1 > maxStage) {
      setGameComplete(true)
      setWinText(`Thanks for playing! Refresh to play again :)`)
      setSnippet('\n')
    } else {
      setStage(stage + 1)
    }
  }

  useEffect(() => {
    hljs.highlightAll()
  }, [snippet])

  useEffect(() => {
    if (gameComplete) {
      return
    }

    setSnippet(loadingMessage)
    getRandomRepository(seenRepositories)
      .then((data) => {
        setRepositoryData(data)
        fetch(data.downloadURL)
          .then(res => res.text())
          .then(text => {
            setSnippet(text)
            setSeenRepositories(seenRepositories.concat(data.repository))
          })
      })
      .catch(e => {
        setSnippet(`some kind of error happened..\n\n${e}\n\nsorry about that. try refreshing the page?`)
      })
  }, [stage])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Head>
          <title>CodeGuessr</title>
          <meta name="description" content="Like GeoGuessr but for code. Guess which popular open source project a code snippet belongs to." />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className={styles.main}>
          <h1 className={styles.title}>
            Welcome to CodeGuessr
          </h1>

          <p className={styles.description}>
            A game for nerds, by a nerd (<a href="https://twitter.com/healeycodes">@healeycodes</a>)
          </p>

          <p className={styles.description}>
            What popular open source repository is this code from?
            <br></br>
            Round <b>{stage}/{maxStage}</b>, {gameComplete && "Final "}Score <b>{score}{gameComplete && "!"}</b>
          </p>

          <SelectSearch
            id="repository-search"
            options={searchItems}
            placeholder="Search/select Top 100 GitHub repositories (by stars)"
            search
          />
          <button disabled={gameComplete} className={styles.guessbtn} onClick={() => guess(false)}>Guess</button>
          <button disabled={gameComplete} className={styles.guessbtn} onClick={() => guess(true)}>Skip</button>
          <p className={styles.guesstext}>{guessText}{" "}{winText}</p>

          {!gameComplete && <pre className={styles.snippet}><code>{snippet}</code></pre>}
          <small>Source: <a href="https://github.com/healeycodes/codeguessr">https://github.com/healeycodes/codeguessr</a></small>
        </main>
      </div>
    </div>
  )
}
