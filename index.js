let cheerio = require('cheerio');
let rp = require('request-promise');
let fs = require('fs');
let BASE_URL = 'http://aucoe.annauniv.edu/cgi-bin/result/cgrade.pl?regno=';//312215104005;
// rp = rp.defaults({proxy:'http://proxy.ssn.net:8080'});
let mongo = require('mongodb').MongoClient;

(async()=>{
    try {
        let db = await mongo.connect('mongodb://localhost:27017/annauniv');
        let col = db.db('annauniv').collection('dec2017');
        let batch = col.initializeUnorderedBulkOp({useLegacyOps: true});
        let cc = 3122;
        for(yc in [14,15,16])
            for(bc in [103,104,105,106,114,120,205])
                for (let i = 0; i<150; i++) {
                    let res = await scrapePage('' + cc+yc+bc + ('00' + i).slice(-3));
                    if (res.Marks && res.Marks.length) {
                        batch.insert({...res, College: '' + cc, Year:""+yc, Department:''+bc });
                    }
                }

        console.log(await batch.execute());
    }
    catch(err){
        console.log(err);
    }

})();


//Status
let state = {
    visited:{},
    max:5000,
    isVisited:(id)=> {
        if(state.visited[id]){
            return 1;
        }
        else{
            state.visited[id]=1;
            return 0;
        }
    },
    success :0,
    failure : 0,
    print:()=>{
        console.log("Success" + state.success ,"Failure:" +state.failure);
    }
};

//SCRAPE THIS URL
const scrapePage = async(id) => {
    if(state.isVisited(id)) return;
    let options = {
        uri:BASE_URL+id,
        transform: body => cheerio.load(body)
    };

    try{
        let $ = await rp(options);
        let studentarr = $('table').eq(1).find('td div').map((i,el)=> $(el).text()).get();
        let rows = $('table').eq(2).find('tr').filter((x)=> x);
        let markarr = $(rows).find('td strong').map((i,el)=> $(el).text()).get();
        let record = {...studentify(studentarr),Marks:markify(markarr)};
        state.success++;
        state.print();
        return record;
    }
    catch(err){
        state.failure++;
        console.log("ERROR on "+err);
        return 0;
    }

}

const markify = (arr)=>{
    let marks = [];
    for(let i=0;i<arr.length;i+=3){
        marks.push({
            Subject:arr[i],
            Grade:arr[i+1],
            Result:arr[i+2].replace('\n','')
        });
    }
    return marks;
};

const studentify = (arr)=> ({
    _id:arr[0],
    Name:arr[1],
    Course:arr[2].replace('\n','')
});

// scrapePage(312215104005);
