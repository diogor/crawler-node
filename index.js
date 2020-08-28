import selenium from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import moment from 'moment'
import dotenv from 'dotenv'
import pg from 'pg'


const args = process.argv.slice(2)
dotenv.config()
const client = new pg.Client()
await client.connect()
const options = new chrome.Options().headless()
const driver = await new selenium.Builder().forBrowser('chrome').setChromeOptions(options).build()

function preConsultaPrecos(api_url, data, regiao) {
    const d = data.split("/")
    const dia = `${d[2]}-${d[1]}-${d[0]}`
    const selectQuery = 'SELECT * FROM pldhorario where dia = $1 and submercado = $2'

    client.query(
        selectQuery,
        [dia, regiao],
        async (err, res) => {
            if (err) {
                console.log(err.stack)
                return
            }
            if (res.rowCount == 0) {
                consultaPrecos(api_url, data, regiao)
            }
        }
    )
}

async function adicionaEntrada(dados) {
    const insertQuery = 'INSERT INTO pldhorario (dia, hora, submercado, preco) VALUES($1, $2, $3, $4) RETURNING *'
    const updateQuery = 'UPDATE pldhorario SET dia = $1, hora = $2, submercado = $3, preco = $4 where dia = $1 and hora = $2 and submercado = $3 and preco = $4'

    const client = new pg.Client()
    await client.connect()

    client.query(
        updateQuery,
        dados,
        (err, res) => {
            if (err) {
                console.log(err.stack)
            }
            if (res.rowCount > 0) {
                console.log(dados, "-> Atualizando")
            } else {
                client.query(
                    insertQuery,
                    dados,
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

async function processaPrecos(precos, data, regiao) {
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
    const url = `${api_url}?periodo=${data}&aba=${regiao}`
    let precos = []
    try {
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
        processaPrecos(precos, data, regiao)
    } catch (e) {
        console.error(e);
    }
}

async function startCrawler() {
    const api_url = "https://www.ccee.org.br/portal/faces/oracle/webcenter/portalapp/pages/publico/oquefazemos/produtos/precos/preco_horario_sombra_grafico.jspx"

    let data = [args[0]]
    let regiao = [args[1]]

    if (!args[0]) {
        data = []
        let b = new moment()
        let a = moment().subtract(30, 'days')

        for (var m = moment(a); m.diff(b, 'days') <= 0; m.add(1, 'days')) {
            data.push(m.format('DD/MM/YYYY'))
        }
    }

    if (!args[1]) {
        regiao = ["sudeste", "sul", "nordeste", "norte"]
    }

    for (let i=0; i<data.length; i++) {
        for (let k=0; k<regiao.length; k++) {
            preConsultaPrecos(api_url, data[i], regiao[k])
        }
    }

}

startCrawler()
setInterval(startCrawler, 60 * 60 * 1000);