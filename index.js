let cheerio = require('cheerio');
let rp = require('request-promise');
// let fs = require('fs');
let BASE_URL = 'http://aucoe.annauniv.edu/cgi-bin/result/cgrade.pl?regno=';//312215104005;
// rp = rp.defaults({proxy:'http://proxy.ssn.net:8080'});
let mongo = require('mongodb').MongoClient;

(async () => {
    let db = await mongo.connect('mongodb://localhost:27017/annauniv');
    let col = db.db('annauniv').collection("dec2017");

    //state
    let state = {
        visited: (await col.find({}, {_id: 1}).toArray()).map(x => x._id),
        isVisited: (id) => state.visited.indexOf(id) != -1,
        tried: 0,
        skipRate:0,
        success: 0,
        failure: 0,
        print: () => {
            console.log(`Tried:${state.tried},Success:${state.success},Failure:${state.failure}`)
        }
    };

    const scrapePage = async (id) => {
        if (!state.isVisited(id)) {
            let options = {
                uri: BASE_URL + id,
                transform: body => cheerio.load(body)
            };
            try {
                let $ = await rp(options);
                return processPage($);
            }
            catch (err) {
                state.failure--;
                console.log("ERROR" + err);
                return 0;
            }

        }
        return 0;
    }

    const processPage = ($) => {
        let studentarr = $('table').eq(1).find('td div').map((i, el) => $(el).text()).get();
        let rows = $('table').eq(2).find('tr').filter((x) => x);
        let markarr = $(rows).find('td strong').map((i, el) => $(el).text()).get();
        let record = {...studentify(studentarr), Marks: markify(markarr)}
        return record;
    };

    const markify = (arr) => {
        let marks = [];
        for (let i = 0; i < arr.length; i += 3) {
            marks.push({
                Subject: arr[i],
                Grade: arr[i + 1],
                Result: arr[i + 2].replace('\n', '')
            });
        }
        return marks;
    };

    const studentify = (arr) => ({
        _id: arr[0],
        Name: arr[1],
        Course: arr[2].replace('\n', '')
    });

    //scraping script
    let cc = 3122;
    for (yc of [14,15,16]) {
        for (bc of [103, 104, 105, 106, 114, 120, 205]) {
            state.skipRate = 0;
            for (let i = 1; i < 120; i++) {
                let examno = '' + cc + yc + bc + ('00' + i).slice(-3);
                if (!state.isVisited(examno)) {
                    console.log("Fetching.." + examno);
                    let res = await scrapePage(examno);
                    console.log(res);
                    if (res && res.Marks && res.Marks.length) {

                        try {
                            let x = await col.insertOne({
                                ...res,
                                College: '' + cc,
                                Year: "" + yc,
                                Department: '' + bc
                            });
                            if(x.insertedId){
                                state.success++;
                            }

                        }
                        catch (err) {
                            console.log("Error on DB" + err);
                            state.failure++;
                        }
                        state.print();
                    }
                    else{
                        state.skipRate++;
                        if(state.skipRate > 4){i=999;}
                    }

                }
                else{
                    console.log("Skipping.."+examno);
                }
            }
        }
    }
    console.log("SCRAPING SUCCESS");


//Status

//SCRAPE THIS URL

})();
