'use client'

import Script from 'next/script'

/**
 * Loads Twitter's widget script and explicitly triggers a DOM scan
 * so any twitter-tweet blockquotes on the page get transformed into
 * proper embedded tweet cards.
 */
export default function TweetLoader() {
  function load() {
    const twttr = (window as any).twttr
    if (twttr?.widgets?.load) {
      twttr.widgets.load()
    }
  }

  return (
    <Script
      src="https://platform.x.com/widgets.js"
      strategy="afterInteractive"
      onLoad={load}
      onReady={load}
    />
  )
}
