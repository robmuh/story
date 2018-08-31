if ( 'serviceWorker' in navigator ) navigator.serviceWorker.register('/sw.js')

let part = {}
let response = {}
let curinput = null
let voices
let voiceNames
let voiceNamesString

const voiceSupport = window.speechSynthesis

// unfortunately onvoiceschanged event not generated for Safari 
const loadVoices = _ => {
  if (!voiceSupport) return
  voices = speechSynthesis.getVoices()
  if (!voices.length) return
  voiceNames = voices.map( _ => _.name )
  voiceNamesString = voiceNames.join(', ')
}

loadVoices()

let loadv = setInterval( _ => {
  loadVoices()
  if (voices.length) clearInterval(loadv)
} , 100)

const defaultState = () => JSON.parse(JSON.stringify({
  line: "",
  page: 0,
  raw: "",
  current: "Welcome", 
  previous: "Welcome",
  voice: {
    on: state.voice.on, // hack to maintain state
    name: "",
    pitch: 1,        // 0 to 2
    rate: 1,         // 0.1 to 10
    volume: 1.0,     // 0 to 1
    lang: 'en-US',
  },
  history: [" "],
  historyIndex: 0,
  historyHTML: null
}))

let state = {
  line: "",
  page: 0,
  raw: "",
  current: "Welcome", 
  previous: "Welcome",
  voice: {
    on: false,
    name: "",
    pitch: 1,        // 0 to 2
    rate: 1,         // 0.1 to 10
    volume: 1.0,       // 0 to 1
    lang: 'en-US',
  },
  history: [" "],
  historyIndex: 0,
  historyHTML: null
}

const reset = () => state = defaultState()

const loadLocalStorage = () => {
  let s = localStorage.getItem('state')
  if (s) state = JSON.parse(s)
  else reset()
}

const repl = document.querySelector("#repl")
const body = document.querySelector("body")

const promptForInput = _ => {
  repl.innerHTML =  repl.innerHTML + "<span class=prompt>&gt;&nbsp</span>"
    + "<span class=input contenteditable></span>"
  focusLastInput()
}

const lastInput = _ => { 
  let inputs = document.getElementsByClassName('input')
  return inputs[inputs.length-1]
}

const focusLastInput = _ => {
    let last = lastInput()
    if (!last) return
    curinput = last
    last.focus()
    let range = document.createRange()
    range.selectNodeContents(last)
    range.collapse(false)
    let sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    repl.scrollTop = repl.scrollHeight
    window.scrollTo(0,document.body.scrollHeight)
}

const save = () => {
  localStorage.setItem('state',JSON.stringify(state))
}

const say = _ => {
  speechSynthesis.cancel()
  let m = new SpeechSynthesisUtterance()
  if (! state.voice.name) state.voice.name = 'Daniel'
  m.voice = voices.filter(_ => _.name === state.voice.name)[0]
  m.volume = state.voice.volume || 1
  m.pitch = state.voice.pitch || 1
  m.rate = state.voice.rate || 1
  m.lang = state.voice.lang || 'en-US'
  m.text = _
  speechSynthesis.speak(m)
}

const print = _ => {
  if ( _ instanceof Array && state.page < _.length ) {
    let buf = _[state.page].replace(/\{\{(\S+)\}\}/, (m,k) => state[k])
    repl.innerHTML = `<p class=p>${buf}</p>`
    if (state.voice.on) say(repl.innerText)
    state.page++
    if (state.page == _.length) {
      state.page = 0
      return false
    } else {
      return true
    }
  } else {
    repl.innerHTML = "<p class=p>" + _ + "</p>"
    if (state.voice.on) say(repl.innerText)
  }
  focusLastInput()
  return false
}

// ---------------------------------------------------------

response._Restart = _ => {
  if (_.line === 'restart') {
    speechSynthesis.cancel()
    reset()
    return 'Restarting.'
  }
}

response._Say = _ => {
  let m = _.raw.match(/^say,?\s+(?:'|")?([^'"]*)/i)
  if (!m) return
  _.voice.on = true
  return `"${m[1]}"`
}

response._TalkToMe = _ => {
  if ( _.line.match(/start\s+talking|talk\s+to\s+me|tell\s+me\s+(about\s+it|more)|^talk$/) ) {
    _.voice.on = true
    return "Ok, I'll start talking now. Tell me to be quiet to stop."
  }
  if ( _.line.match(/you('?re?|\s+are)\s+too?\s+loud|stop\s+talking|be\s*quiet|shut\s*up/) ) {
    say('')
    _.voice.on = false
    return "Ok, I'll be quiet."
  }
}

response._AreYouSure = _ => {
  if (_.line.match(/are\s+you\s+sure/)) {
    return "Of course I'm sure."
  }
}

response._Talking = _ => {
  let prev = state.voice.name
  let m = _.line.match(/talk(?:ing)?\s+like\s+(an?\s+)?(\S.+)/)
  let voice
  if (m !== null) {
    if (! voiceSupport ) return `Doesn't look like I have a voice on this device. Sorry`
    voice = m[2]
    state.voice.on = true
    if (navigator.appVersion.match(/pixel|android/i)) {
      return `I can only start talking with this voice. I hope that's ok. Tell me to be quiet to stop.`
    }
    switch (voice) {
      case 'girl':
      case 'chick':
      case 'woman':
        state.voice.name = 'Google US English'
        state.voice.rate = 1.01
        state.voice.pitch = 1.1
        break
      case 'boy':
      case 'dude':
      case 'guy':
      case 'man':
        if (navigator.appVersion.match(/mac/i)) {
          state.voice.name = 'Daniel'
        } else {
          state.voice.name = 'English United Kingdom'
        }
        state.rate = 1.0
        state.pitch = 1 
        break
      case 'alien':
      case 'robot':
      case 'bot':
        if (navigator.appVersion.match(/mac/i)) {
          state.voice.name = 'Zarvox'
          break
        }
      default:
        let v = voices.filter( _ => {
          if (_.name !== undefined) {
            if (_.name.toLowerCase().includes(voice)) {
              return _
            }
          }
        })[0]
        state.voice.name = v ? v.name : state.voice.name
    }
    if (state.voice.name === prev) {
      return `Can't find a new voice for ${voice}. Sorry.`
    } else {
      return `Ok, I'll start talking like ${m[1]===undefined?'':m[1]}${voice}. Tell me to be quiet to stop.`
    }
  }
}

response._Voices = _ => {
  if (_.line.match(/((^(show|tell|what|which).+)|^)voices/)) {
    alert(voiceNamesString)
    return `To use one of those voices say "Tell me to talk like [voice]".
    You don't need the whole name, just a keyword from it. Say "back" to
    if you need to repeat what was said.`
  }
}

response._Back = _ => {
  if (! _.line.match(/^(go\s+)?back$/)) return
  if (_.page > 1) { _.page -= 2; return }
  if (_.page <= 1) _.page = 0 
  return `Can't go back further. Sorry.`
}

// ---------------------------------------------------------

repl.onkeydown = _ => {
  let data = (curinput) ? curinput.textContent: ""
  let key = _.key

  if (key === 'ArrowUp') {
    if (state.historyIndex > 0) {
      state.historyIndex -= 1
      repl.innerHTML = `${state.historyHTML}<span class=prompt>> </span><span class=input contenteditable>${state.history[state.historyIndex]}</span>`
      focusLastInput()
    }
    _.preventDefault()
  } else if (key === 'ArrowDown') {
    if (state.historyIndex < state.history.length-1) {
      state.historyIndex += 1
      repl.innerHTML = `${state.historyHTML}<span class=prompt>> </span><span class=input contenteditable>${state.history[state.historyIndex]}</span>`
      focusLastInput()
    }
    _.preventDefault()
  }


  //console.log(key)

  // add typing speed detection

  // only a single line of input allowed

  if (key !== "Enter" ) return
  _.preventDefault()

  state.raw = data.trim()
  state.line = state.raw.toLowerCase()

  if (state.historyIndex >= 500) {
    state.history.splice(0, 1)
    state.history.pop()
    state.history.push(state.raw)
    state.history.push(" ")
  } else {
    state.historyIndex = state.history.length
    state.history.pop()
    state.history.push(state.raw)
    state.history.push(" ")
  }



 

  // TODO: add sudo support

  // catch any responses that have priority over
  // the current part handler, use this for actions
  // such as flipping a coin or showing inventory
  
  for (const [name,method] of Object.entries(response)) {
    let response = method(state)
    if (response) {
      print(response)
      if (_.page > 0) _.page-- // ugly hack until pages fixed
      save()
      state.historyHTML = repl.innerHTML
      promptForInput()
      return
    }
  }

  let previous = state.current
  p = part[state.current]

  // make sure we have some parts to work with
  if (!part.Welcome) {
    print(`Missing Welcome Part<br><i class=small>You are missing the first Welcome part, which
    all text bots require.`)
    reset()
  } else if (!p) {
    print(`Part Unavailable<br>
          <i class=small>Contact the author to let them know. It could
          be that this is the default part and it is
          not defined in the parts file.</i>`)
    state.current = state.previous
  } else {
    let c = p(state)
    state.historyHTML = repl.innerHTML
    if (c) {
      state.current = c
      if (state.page === 0) 
      state.previous = previous
    }
  }
  save()
  promptForInput()
  return
}

const triggerEnter = _ => 
  repl.onkeydown(new KeyboardEvent('keypress',{'key':'Enter'}))

window.onclick = _ => focusLastInput()

window.onload = _ => {
  loadLocalStorage()
  triggerEnter()
  state.history.pop()
}
