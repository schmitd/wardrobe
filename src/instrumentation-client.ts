import { initBotId } from 'botid/client/core';

initBotId({
    protect: [
        {
            path: '/api/uploadthing',
            method: 'POST',
        }
    ],
});
