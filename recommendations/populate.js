const request = require('request-promise-native');
const fs = require('fs');
const path = require('path');
const sdk = require('./sdk')(process.env.RECOMMENDATION_API_KEY);

const catalog = process.argv[2];
if (!catalog || !fs.existsSync(catalog)) {
    throw 'Please specify a valid file system path where you generated recommendations-catalog.csv and recommendations-usage.csv';
}

const modelName = process.argv[3] || 'eComm-Chatbot';
const description = process.argv[4] || 'Adventure Works Recommendations';

const run = async () => {
    const models = await sdk.model.list();

    let model = models.find(m => m.name === modelName);
    if (model) {
        console.log(`There is already a recommendation model named ${modelName}. The existing model needs to be deleted first`);

        await sdk.model.delete(model.id);
    }

    model = await sdk.model.create(modelName, description);
    console.log(`Model ${model.id} created succesfully`);

    await sdk.upload.catalog(model.id, 'AdventureWorks', path.resolve(catalog, 'recommendations-catalog.csv'));
    await sdk.upload.usage(model.id, 'OnlineSales', path.resolve(catalog, 'recommendations-usage.csv'));

    const build = await sdk.build.fbt(model.id, 'FBT build for Adventure Works');
    console.log(`FBT build ${build.buildId} created succesfully. Will now wait for the training to finish.`);

    let trained = false;
    while (!trained) {
        let check = await sdk.build.get(model.id, build.buildId);

        if (!['NotStarted', 'Running'].includes(check.status)) {
            trained = true;
            console.log(`Build training finished: ${check.status}`);
        } else {
            console.log(`Training is ${check.status}. Will check again in 30 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    return { model, build };
}

run().then(({ model, build }) => {
    console.log('All said and done');
    console.log(`Set RECOMMENDATION_MODEL to ${model.id}`);
    console.log(`Set RECOMMENDATION_BUILD to ${build.buildId}`);
});;


