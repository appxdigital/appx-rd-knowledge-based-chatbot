import knex from "knex";

const db = knex({
   client: 'mysql',
   connection: {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USERNAME
   },
});

export {db};