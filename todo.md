Todo
[x] Setup next supabase stuff
[x] Git 
[x] Deploy to vercel
[x] Setup user login through gmail
[x] Think of the composio flow.
[x] Setup how to get user permission to access their gmail mails
[x] Setup last syced on user and display that. If user is first time then tell him that. Tell him you are fetching emails from last month and syncing them. display the loading spinner
[ ] Setup workflow to fetch and organise email from inbox in the last month
[ ] Setup intelligence to go through all the email subject and select order related emails
[ ] Store all the relevant emails in supabase
[ ] Sync every time a user goes to page /orders  
[ ] Setup a cron endpoint to fetch all users every 15 minutes and sync

[ ] Make landing page better add screenshots and what not
[ ] Remove the your boxes button from the sign in page. It's confusing

* Batch pull all emails from last month make the orders table with LLM calls
* Store order details and last sync detail for each user. 
* Write a cron job that pulls all these emails for every user every 15 minutes.
* Every time a user goes to page /orders look at last sync time if its more than 5 minutes. sync again.