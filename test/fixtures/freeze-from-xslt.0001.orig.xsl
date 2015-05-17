<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE xsl:stylesheet SYSTEM "./freeze-from-xslt.0001.orig.ent">

<!-- Some comment -->

<xsl:stylesheet
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:math="http://exslt.org/math"
    exclude-result-prefixes="math"
    version="1.0">

    <!-- Yet another comment -->
    <!--
    One more
    Multiline this time
    -->
    <xsl:import href="freeze-from-xslt.0001.orig.dummy.xsl" />

    <!-- Import below should not be touched -->
    <!-- <xsl:import href="non-existent.xsl" /> -->

    <xsl:template match="page" mode="css">
        <link rel="stylesheet" href="/freeze-from-xslt.0001.orig.css"/>
    </xsl:template>

 <xsl:template match="page" mode="variables">
     <xsl:variable name="currcss">
         <xsl:value-of select="xxx:include-static('/freeze-from-xslt.0001.orig.css')" />
     </xsl:variable>
 </xsl:template>

</xsl:stylesheet>
