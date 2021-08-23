const { App } = require('@slack/bolt');
const { config } = require('dotenv');
const CountryLanguage = require('country-language');
const {Translate} = require('@google-cloud/translate').v2;

// Load dotenv variables 
config();

// Initialize Slack App
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Creates a client
const translate = new Translate();

// When a reaction is added
app.event('reaction_added', async ({ event, client }) => {
    // Getting info about the event 
    const {item: {channel, ts}, reaction} = event; 
    // Getting language info from reaction --> ex) language{code:'en', name:'English'}
    const language = getLangFromReaction(reaction);
    if (language == undefined){ // Do nothing if emoji isn't a country flag
        console.log("Unable to translate");
        return;
    }

    // Get the text to translate 
    const historyResult = await client.conversations.history({
        channel,
        oldest: ts,
        latest: ts,
        inclusive: true,
        limit: 1
    });
    if (historyResult.messages.length <= 0) return; // Something went wrong
    const {text: textToTranslate } =  historyResult.messages[0];

    // Translate the text 
    const translatedText = await translateText(textToTranslate, language.code);
    
    // Send translation to Slack 
    try {
        // Call chat.postMessage with the built-in client
        const result = await client.chat.postMessage({
        channel: channel,
        thread_ts: ts,
        text: `_Translation for :${reaction}:_\n${translatedText}`
        });
    }
    catch (error) {
        console.error('error:', error);
    }
});

// Start our Slack App 
(async () => {
    await app.start(process.env.PORT || 3000); 
    console.log('Bolt app is running!');
})(); 

/**
 * Get language info from the Slack emoji reaction 
 * @param {String} reaction 
 * @returns {Object} lang{code, name} or undefined
 */
function getLangFromReaction(reaction){
    let lang = {code:'', name:''};
    // Remove "flag-" from code if necessary
    reaction = reaction.trim();
    const [prefix, emojiCode] = reaction.includes('flag-') ? reaction.split('-'):['', reaction];
    
    // Turn country code into corresponding language code
    try{
        lang.code = CountryLanguage.getCountryLanguages(emojiCode)[0].iso639_1;
    }
    catch(err){
        return undefined;
    }

    // Turn language code into language name 
    try{
        lang.name = CountryLanguage.getLanguage(lang.code).name[0];
    }
    catch(err){
        return undefined;
    }
    return lang;
}

/**
 * Use the Google Translate API to translate the text
 * @param {String} text text to translate
 * @param {String} language 
 */
async function translateText(text, language){
    // Translates the text into the target language.
    let [translation] = await translate.translate(text, language);
    return translation; 
}