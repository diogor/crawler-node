import selenium from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import moment from 'moment'
import dotenv from 'dotenv'
import pg from 'pg'


const args = process.argv.slice(2)
dotenv.config()
const options = new chrome.Options().headless()
const driver = new selenium.Builder().forBrowser('chrome').setChromeOptions(options).build()

const pool = new pg.Pool()

pool.on('error', (err, _) => {
    console.error('Erro no banco de dados:  ', err)
    process.exit(-1)
})

async function preConsultaPrecos(api_url, data, regiao) {
    const d = data.split("/")
    const dia = `${d[2]}-${d[1]}-${d[0]}`
    const selectQuery = 'SELECT * FROM pldhorario where dia = $1 and submercado = $2'

    await makeQuery(selectQuery, [dia, regiao],
        async (err, res) => {
            if (err) {
                console.log(err.stack)
                return
            }
            if (res.rowCount == 0) {
                consultaPrecos(api_url, data, regiao)
            } else {
                console.log(dia, regiao, "-> Já existe no banco")
            }
        }
    )
}

async function makeQuery(query, dados, callback) {
    const client = await pool.connect()
    try {
        client.query(
            query,
            dados,
            callback
        )
    } finally {
        client.release()
    }
}

async function adicionaEntrada(dados) {
    const insertQuery = 'INSERT INTO pldhorario (dia, hora, submercado, preco) VALUES($1, $2, $3, $4) RETURNING *'
    const updateQuery = 'UPDATE pldhorario SET dia = $1, hora = $2, submercado = $3, preco = $4 where dia = $1 and hora = $2 and submercado = $3 and preco = $4'

    makeQuery(updateQuery, dados,
        async (err, res) => {
            if (err) {
                console.log(err.stack)
            }
            if (res.rowCount > 0) {
                console.log(dados, "-> Atualizando")
            } else {
                makeQuery(insertQuery, dados,
                    (err, _) => {
                        if (err) {
                            console.log(err.stack)
                        }
                            console.log(dados, "-> Novo registro")
                    }
                )
            }
        }
    )
}

async function processaPrecos(data, regiao, api_url) {
    const url = `${api_url}?periodo=${data}&aba=${regiao}`
    let precos = []

    await driver.get(url);
    const tds = await driver.findElements(selenium.By.tagName('tr'));

    for (let i=1; i<tds.length; i++) {
        await tds[i].getText().then(s => {
            let linha = s.split(" ")
            precos[i-1] = []
            linha.forEach(l => {
                if (l !== '') precos[i-1].push(l)
            })
        });
    }

    for (let i=0; i<precos.length; i++) {
        const p = precos[i]
        const d = data.split("/")
        const dia = `${d[2]}-${d[1]}-${d[0]}`
        const hora = parseInt(p[0].split(":")[0])
        const valor = parseFloat(p[p.length-1].replace(",", ".")).toFixed(2)
        const dados = [dia, hora, regiao, valor]

        adicionaEntrada(dados)
    }
}

async function consultaPrecos(api_url, data, regiao) {
    try {
        processaPrecos(data, regiao, api_url)
    } catch (e) {
        console.error(e);
    }
}

async function startCrawler(args) {
    const api_url = "https://www.ccee.org.br/portal/faces/oracle/webcenter/portalapp/pages/publico/oquefazemos/produtos/precos/preco_horario_sombra_grafico.jspx"

    let data = [args[0]]
    let regiao = [args[1]]

    if (!args[0]) {
        data = []
        let b = moment().subtract(1, 'days')
        let a = moment().subtract(31, 'days')

        for (var m = moment(a); m.diff(b, 'days') <= 0; m.add(1, 'days')) {
            data.push(m.format('DD/MM/YYYY'))
        }
    }

    if (!args[1]) {
        regiao = ["sudeste", "sul", "nordeste", "norte"]
    }

    for (let i=0; i<regiao.length; i++) {
        await consultaPrecos(api_url, moment().format('DD/MM/YYYY'), regiao[i])
    }

    for (let i=0; i<data.length; i++) {
        for (let k=0; k<regiao.length; k++) {
            await preConsultaPrecos(api_url, data[i], regiao[k])
        }
    }
}

await startCrawler(args)
