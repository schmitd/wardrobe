import { initBotId } from 'botid/client/core';

initBotId({
    protect: [
        {
            path: '/api/uploadthing',
            method: 'POST',
        },
        {
            path: '/api/stripe/webhook',
            method: 'POST',
        }
    ],
});
